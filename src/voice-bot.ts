/**
 * VoiceBot - Main orchestrator class
 * 
 * Provides a high-level API for creating voice conversation bots
 * using PersonaPlex and Twilio.
 */

import { EventEmitter } from 'events';
import type { VoiceBotConfig } from './config.js';
import { PersonaPlexClient } from './personaplex/client.js';
import { AudioBuffer, resample, TWILIO_SAMPLE_RATE, PERSONAPLEX_SAMPLE_RATE, FRAME_SIZE_MS, OpusCodec } from './audio/index.js';
import { createLogger } from './utils/logger.js';
import type { WebSocket } from 'ws';

const logger = createLogger('voice-bot');

/**
 * VoiceBot events
 */
export interface VoiceBotEvents {
  /** Bot is ready to receive audio */
  ready: [];
  /** Audio response from bot (PCM Float32 at target sample rate) */
  audio: [pcm: Float32Array];
  /** Text response from bot */
  text: [text: string];
  /** Error occurred */
  error: [error: Error];
  /** Session ended */
  ended: [];
}

/**
 * Options for creating a VoiceBot session
 */
export interface VoiceBotSessionOptions {
  /** Twilio WebSocket (if using with Twilio) */
  twilioWs?: WebSocket;
  /** Output sample rate (default: 8000 for Twilio) */
  outputSampleRate?: number;
  /** Input sample rate (default: 8000 for Twilio) */
  inputSampleRate?: number;
}

/**
 * VoiceBot - High-level voice conversation bot
 * 
 * @example
 * ```typescript
 * const bot = new VoiceBot(config);
 * 
 * bot.on('text', (text) => {
 *   console.log('Bot said:', text);
 * });
 * 
 * bot.on('audio', (pcm) => {
 *   // Play or send audio
 * });
 * 
 * await bot.startSession();
 * 
 * // Send audio from user
 * bot.sendAudio(userPcm);
 * 
 * // End session
 * await bot.endSession();
 * ```
 */
export class VoiceBot extends EventEmitter<VoiceBotEvents> {
  private readonly config: VoiceBotConfig;
  private personaplexClient: PersonaPlexClient | null = null;
  private inputBuffer: AudioBuffer | null = null;
  private isSessionActive: boolean = false;
  private opusCodec: OpusCodec | null = null;
  private inputSampleRate: number = TWILIO_SAMPLE_RATE;

  constructor(config: VoiceBotConfig) {
    super();
    this.config = config;
    this.opusCodec = new OpusCodec();
  }

  /**
   * Start a new conversation session
   */
  async startSession(options?: VoiceBotSessionOptions): Promise<void> {
    if (this.isSessionActive) {
      throw new Error('Session already active');
    }

    this.inputSampleRate = options?.inputSampleRate ?? TWILIO_SAMPLE_RATE;

    // Create input buffer for accumulating audio frames (PCM Float32)
    const frameSize = Math.round(PERSONAPLEX_SAMPLE_RATE * FRAME_SIZE_MS / 1000);
    this.inputBuffer = new AudioBuffer(frameSize);

    // Ensure codec is ready
    if (!this.opusCodec) {
        this.opusCodec = new OpusCodec();
    }

    // Create PersonaPlex client
    this.personaplexClient = new PersonaPlexClient({
      config: this.config.personaplex,
      autoReconnect: true,
      maxReconnectAttempts: 30, // Retry for ~2 minutes (enough for CPU load time)
      reconnectDelay: 2000,
    });

    // Set up event handlers
    this.personaplexClient.on('audio', (opusData) => {
      // Decode Opus to PCM
      try {
        if (this.opusCodec) {
          const decodedPcm = this.opusCodec.decode(opusData);
          this.emit('audio', decodedPcm);
        }
      } catch (err) {
        logger.error({ err }, 'Failed to decode Opus audio');
      }
    });

    this.personaplexClient.on('text', (text) => {
      this.emit('text', text);
    });

    this.personaplexClient.on('error', (error) => {
      this.emit('error', error);
    });

    this.personaplexClient.on('disconnected', () => {
      if (this.isSessionActive) {
        this.isSessionActive = false;
        this.emit('ended');
      }
    });

    // Connect
    try {
      await this.personaplexClient.connect();
      this.isSessionActive = true;
      this.emit('ready');
      logger.info('VoiceBot session started');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Send audio to the bot
   * 
   * @param pcm - PCM Float32 audio data at inputSampleRate
   */
  sendAudio(pcm: Float32Array): void {
    if (!this.isSessionActive || !this.personaplexClient || !this.inputBuffer) {
      throw new Error('Session not active');
    }

    // Resample to PersonaPlex rate if needed
    let audioData = pcm;
    if (this.inputSampleRate !== PERSONAPLEX_SAMPLE_RATE) {
      audioData = resample(pcm, this.inputSampleRate, PERSONAPLEX_SAMPLE_RATE);
    }

    // Add to buffer
    this.inputBuffer.push(audioData);

    // Process complete frames
    while (this.inputBuffer.hasFrame()) {
      const frame = this.inputBuffer.readFrame();
      if (frame && this.opusCodec) {
          // Encode to Opus and send
           try {
              const opusPacket = this.opusCodec.encode(frame);
              this.personaplexClient.sendAudio(opusPacket);
           } catch (err) {
              logger.error({ err }, 'Failed to encode Opus audio');
           }
      }
    }
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.isSessionActive) {
      return;
    }

    this.isSessionActive = false;
    await this.cleanup();
    this.emit('ended');
    logger.info('VoiceBot session ended');
  }

  /**
   * Check if session is active
   */
  get active(): boolean {
    return this.isSessionActive;
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    if (this.personaplexClient) {
      await this.personaplexClient.close();
      this.personaplexClient = null;
    }
    if (this.opusCodec) {
       this.opusCodec.delete();
       this.opusCodec = null;
    }
    this.inputBuffer = null;
  }
}
