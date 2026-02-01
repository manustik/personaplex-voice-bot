/**
 * Twilio Media Streams Handler
 * 
 * Handles the WebSocket connection from Twilio Media Streams,
 * parsing incoming audio and sending outgoing audio.
 * 
 * Twilio Media Streams:
 * - Sends audio in mu-law format at 8kHz
 * - Audio is base64 encoded in JSON messages
 * - Sends metadata events (start, stop, dtmf, etc.)
 */

import { EventEmitter } from 'events';
import { mulawToPcm, pcmToMulaw } from '../audio/converter.js';

/**
 * Twilio Media Stream event types
 */
export type TwilioStreamEvent = 
  | 'connected'
  | 'start'
  | 'media'
  | 'stop'
  | 'dtmf'
  | 'mark';

/**
 * Twilio Media Stream message (from Twilio)
 */
export interface TwilioMediaMessage {
  event: TwilioStreamEvent;
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // Base64 encoded audio
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
  dtmf?: {
    track: string;
    digit: string;
  };
  mark?: {
    name: string;
  };
}

/**
 * Events emitted by TwilioMediaHandler
 */
export interface TwilioMediaHandlerEvents {
  /** Stream connected */
  connected: [];
  /** Stream started with metadata */
  start: [streamSid: string, callSid: string];
  /** Audio received (PCM Float32) */
  audio: [pcm: Float32Array, timestamp: number];
  /** Stream stopped */
  stop: [];
  /** DTMF digit received */
  dtmf: [digit: string];
  /** Error occurred */
  error: [error: Error];
}

/**
 * Handler for Twilio Media Streams WebSocket connection
 * 
 * @example
 * ```typescript
 * const handler = new TwilioMediaHandler();
 * 
 * handler.on('audio', (pcm, timestamp) => {
 *   // Process incoming audio
 * });
 * 
 * handler.on('start', (streamSid, callSid) => {
 *   console.log(`Call ${callSid} started`);
 * });
 * 
 * // In your WebSocket handler:
 * ws.on('message', (data) => {
 *   handler.handleMessage(JSON.parse(data.toString()));
 * });
 * 
 * // To send audio back:
 * const response = handler.createAudioMessage(pcmData);
 * ws.send(response);
 * ```
 */
export class TwilioMediaHandler extends EventEmitter<TwilioMediaHandlerEvents> {
  private streamSid: string | null = null;
  private callSid: string | null = null;
  private mediaSequence: number = 0;

  constructor() {
    super();
  }

  /**
   * Handle an incoming message from Twilio
   */
  handleMessage(message: TwilioMediaMessage): void {
    try {
      switch (message.event) {
        case 'connected':
          this.emit('connected');
          break;

        case 'start':
          if (message.start) {
            this.streamSid = message.start.streamSid;
            this.callSid = message.start.callSid;
            this.emit('start', this.streamSid, this.callSid);
          }
          break;

        case 'media':
          if (message.media?.payload) {
            this.handleMediaPayload(message.media.payload, message.media.timestamp);
          }
          break;

        case 'stop':
          this.emit('stop');
          this.streamSid = null;
          this.callSid = null;
          break;

        case 'dtmf':
          if (message.dtmf?.digit) {
            this.emit('dtmf', message.dtmf.digit);
          }
          break;
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle incoming media payload
   */
  private handleMediaPayload(base64Payload: string, timestamp: string): void {
    // Decode base64 to buffer
    const mulaw = Buffer.from(base64Payload, 'base64');
    
    // Convert mu-law to PCM
    const pcm = mulawToPcm(mulaw);
    
    // Emit audio event
    const timestampMs = parseInt(timestamp, 10) || Date.now();
    this.emit('audio', pcm, timestampMs);
  }

  /**
   * Create an audio message to send back to Twilio
   * 
   * @param pcm - PCM Float32 audio data (at 8kHz!)
   * @returns JSON string to send via WebSocket
   */
  createAudioMessage(pcm: Float32Array): string {
    if (!this.streamSid) {
      throw new Error('Stream not started');
    }

    // Convert PCM to mu-law
    const mulaw = pcmToMulaw(pcm);
    
    // Encode to base64
    const payload = mulaw.toString('base64');
    
    // Create Twilio media message
    const message = {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload,
      },
    };

    this.mediaSequence++;
    
    return JSON.stringify(message);
  }

  /**
   * Create a mark message (for tracking audio playback)
   */
  createMarkMessage(name: string): string {
    if (!this.streamSid) {
      throw new Error('Stream not started');
    }

    return JSON.stringify({
      event: 'mark',
      streamSid: this.streamSid,
      mark: { name },
    });
  }

  /**
   * Create a clear message (to clear the audio buffer)
   */
  createClearMessage(): string {
    if (!this.streamSid) {
      throw new Error('Stream not started');
    }

    return JSON.stringify({
      event: 'clear',
      streamSid: this.streamSid,
    });
  }

  /**
   * Get current stream SID
   */
  get currentStreamSid(): string | null {
    return this.streamSid;
  }

  /**
   * Get current call SID
   */
  get currentCallSid(): string | null {
    return this.callSid;
  }

  /**
   * Check if stream is active
   */
  get isActive(): boolean {
    return this.streamSid !== null;
  }

  /**
   * Reset handler state
   */
  reset(): void {
    this.streamSid = null;
    this.callSid = null;
    this.mediaSequence = 0;
  }
}
