/**
 * Bridge Server
 * 
 * Fastify server that bridges Twilio Media Streams with PersonaPlex using VoiceBot.
 */

import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import type { WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadConfig, type VoiceBotConfig } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { generateStreamTwiml } from '../twilio/twiml.js';
import { TwilioMediaHandler } from '../twilio/media-streams.js';
import { VoiceBot } from '../voice-bot.js';
import { resample, PERSONAPLEX_SAMPLE_RATE, TWILIO_SAMPLE_RATE } from '../audio/index.js';

const logger = createLogger('server');

/**
 * Create configured Fastify server
 */
export async function createServer(config?: VoiceBotConfig): Promise<FastifyInstance> {
  const cfg = config ?? loadConfig();
  
  const server = Fastify({
    logger: {
      level: cfg.logLevel,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // Register WebSocket plugin
  await server.register(websocket);

  // Register Static file serving (for Web Client)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webClientPath = path.resolve(__dirname, '../../examples/web-client');
  
  await server.register(fastifyStatic, {
    root: webClientPath,
    prefix: '/', 
  });

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // TwiML endpoint for Twilio webhook
  server.all('/twiml', async (request, reply) => {
    const host = request.headers.host ?? 'localhost:3000';
    const protocol = request.headers['x-forwarded-proto'] ?? 'http';
    const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${host}/media-stream`;
    
    logger.info({ wsUrl }, 'Generating TwiML');
    
    const twiml = generateStreamTwiml(wsUrl, 'Connected to voice assistant. You can start speaking.');
    
    reply.type('text/xml');
    return twiml;
  });

  // Media Stream WebSocket endpoint
  server.get('/media-stream', { websocket: true }, (socket, _request) => {
    handleMediaStream(socket, cfg);
  });

  return server;
}

/**
 * Handle a Twilio Media Stream WebSocket connection
 */
async function handleMediaStream(ws: WebSocket, config: VoiceBotConfig): Promise<void> {
  const callLogger = createLogger('call');
  callLogger.info('New media stream connection');

  const twilioHandler = new TwilioMediaHandler();
  
  // Use VoiceBot orchestrator
  const bot = new VoiceBot(config);
  
  // State to track if we should send audio
  let streamSid: string | null = null;

  // 1. Connect VoiceBot audio -> Twilio
  bot.on('audio', (pcm) => { // pcm is 24kHz
    if (!streamSid) return;
    
    // Resample 24k -> 8k for Twilio
    const resampled = resample(pcm, PERSONAPLEX_SAMPLE_RATE, TWILIO_SAMPLE_RATE);
    
    try {
        const msg = twilioHandler.createAudioMessage(resampled);
        if (ws.readyState === ws.OPEN) {
             ws.send(msg);
        }
    } catch (err) {
        callLogger.error({ err }, 'Failed to send audio to Twilio');
    }
  });

  bot.on('text', (text) => {
      callLogger.info({ text }, 'Bot said');
  });
  
  bot.on('ready', () => {
      callLogger.info('Bot ready');
  });
  
  bot.on('error', (err) => {
      callLogger.error({ err }, 'Bot error');
  });

  // 2. Connect Twilio events -> VoiceBot
  
  twilioHandler.on('start', async (sid, callSid) => {
      streamSid = sid;
      callLogger.info({ streamSid, callSid }, 'Stream started');
      
      try {
          // Initialize bot session expecting 8kHz input
          await bot.startSession({ 
              inputSampleRate: TWILIO_SAMPLE_RATE 
          });
      } catch (err) {
          callLogger.error({ err }, 'Failed to start bot session');
      }
  });

  twilioHandler.on('audio', (pcm, _timestamp) => {
      // pcm is 8kHz (decoded from mulaw)
      if (bot.active) {
          bot.sendAudio(pcm);
      }
  });

  twilioHandler.on('stop', async () => {
      callLogger.info('Stream stopped');
      streamSid = null;
      await bot.endSession();
  });

  // 3. Handle WebSocket messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      twilioHandler.handleMessage(message);
    } catch (error) {
      callLogger.error({ error }, 'Failed to parse message');
    }
  });

  ws.on('close', async () => {
    callLogger.info('WebSocket closed');
    await bot.endSession();
  });

  ws.on('error', (error) => {
    callLogger.error({ error: error.message }, 'WebSocket error');
  });
}

/**
 * Start the server
 */
export async function startServer(config?: VoiceBotConfig): Promise<FastifyInstance> {
  const cfg = config ?? loadConfig();
  const server = await createServer(cfg);

  try {
    await server.listen({ port: cfg.server.port, host: cfg.server.host });
    logger.info(`Server listening on http://${cfg.server.host}:${cfg.server.port}`);
    logger.info(`TwiML endpoint: http://${cfg.server.host}:${cfg.server.port}/twiml`);
    logger.info(`Web Client: http://${cfg.server.host}:${cfg.server.port}/index.html`);
    return server;
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    throw error;
  }
}

// Run if this is the main module
// Logic moved to src/server/start.ts to avoid ESM/Windows path issues

