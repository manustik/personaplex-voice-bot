/**
 * Mock PersonaPlex Server
 * 
 * Simulates the PersonaPlex WebSocket server for testing purposes.
 * Generates a 440Hz sine wave audio signal to test the audio pipeline.
 * 
 * Usage:
 *   npx tsx examples/mock-server.ts
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from '../src/utils/logger.js';
import { MessageType } from '../src/personaplex/protocol.js';
import { OpusCodec } from '../src/audio/opus.js';

const logger = createLogger('mock-server');
const PORT = 8998;
const SAMPLE_RATE = 24000;
const FRAME_DURATION_MS = 80;
const SAMPLES_PER_FRAME = Math.floor(SAMPLE_RATE * FRAME_DURATION_MS / 1000); // 1920 samples

// Pre-calculate a sine wave frame (440Hz)
function createSineWaveFrame(frequency: number, sampleRate: number, sampleCount: number, phaseOffset: number = 0): { buffer: Float32Array, nextPhase: number } {
  const pcm = new Float32Array(sampleCount);
  let phase = phaseOffset;
  const phaseStep = (2 * Math.PI * frequency) / sampleRate;

  for (let i = 0; i < sampleCount; i++) {
    pcm[i] = Math.sin(phase) * 0.5; // 0.5 amplitude
    phase += phaseStep;
  }

  // Return Float32Array directly for the codec
  return { 
    buffer: pcm,
    nextPhase: phase 
  };
}

function startMockServer() {
  const wss = new WebSocketServer({ port: PORT });
  const opusCodec = new OpusCodec();
  
  logger.info(`Mock PersonaPlex Server running on ws://localhost:${PORT}`);
  logger.info('Simulating 440Hz Sine Wave (Opus Encoded 24kHz)');

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    logger.info({ 
      voice: params.get('voice_prompt'),
      text: params.get('text_prompt') 
    }, 'Client connected');

    // 1. Send Handshake
    sendHandshake(ws);

    // 2. Start sending audio
    setTimeout(() => {
      logger.info('Sending audio/text...');
      sendText(ws, 'Testing audio pipeline. Sending 5 seconds of 440Hz tone.');
      
      let packetCount = 0;
      let currentPhase = 0;
      const maxPackets = (5000 / FRAME_DURATION_MS); // 5 seconds

      const interval = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN || packetCount >= maxPackets) {
          clearInterval(interval);
          if (packetCount >= maxPackets) {
             logger.info('Finished sending audio test.');
             sendText(ws, 'Audio test complete.');
          }
          return;
        }

        const { buffer, nextPhase } = createSineWaveFrame(440, SAMPLE_RATE, SAMPLES_PER_FRAME, currentPhase);
        currentPhase = nextPhase;
        
        const encodedOpus = opusCodec.encode(buffer);
        sendAudio(ws, encodedOpus);
        packetCount++;
      }, FRAME_DURATION_MS); 
      
    }, 1000);

    // Echo handling
    ws.on('message', (data: Buffer) => {
      if (data.length === 0) return;
      
      const msgType = data[0];

      if (msgType === MessageType.TEXT) {
         const text = data.subarray(1).toString();
         logger.info({ text }, 'User said');
         
         // Basic text response simulation
         if (text.includes('hello')) {
             sendText(ws, 'Hello there! I am a mock AI.');
         }
      } else if (msgType === MessageType.AUDIO) {
          // Echo audio back to client (Latency test)
          // We just send the same Opus packet back
          if (ws.readyState === WebSocket.OPEN) {
              ws.send(data);
          }
      }
    });

    ws.on('close', () => {
      logger.info('Client disconnected');
    });
  });
}

function sendHandshake(ws: WebSocket) {
  const msg = Buffer.alloc(1);
  msg[0] = MessageType.HANDSHAKE;
  ws.send(msg);
}

function sendText(ws: WebSocket, text: string) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const textBytes = Buffer.from(text, 'utf-8');
  const msg = Buffer.alloc(1 + textBytes.length);
  msg[0] = MessageType.TEXT;
  textBytes.copy(msg, 1);
  ws.send(msg);
}

function sendAudio(ws: WebSocket, audio: Buffer) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const msg = Buffer.alloc(1 + audio.length);
  msg[0] = MessageType.AUDIO;
  audio.copy(msg, 1);
  ws.send(msg);
}

startMockServer();
