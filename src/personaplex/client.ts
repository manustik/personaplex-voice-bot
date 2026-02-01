/**
 * PersonaPlex WebSocket Client
 * 
 * Handles real-time communication with the PersonaPlex server
 * for full-duplex speech-to-speech conversations.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { encodeAudioMessage, decodeMessage, type PersonaPlexMessage } from './protocol.js';
import type { PersonaPlexConfig } from '../config.js';

/**
 * Client connection options
 */
export interface PersonaPlexClientOptions {
  /** PersonaPlex configuration */
  config: PersonaPlexConfig;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  /** Max reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in ms */
  reconnectDelay?: number;
}

/**
 * Client events
 */
export interface PersonaPlexClientEvents {
  /** Emitted when connected and ready */
  connected: [];
  /** Emitted on disconnect */
  disconnected: [reason: string];
  /** Emitted on error */
  error: [error: Error];
  /** Emitted when audio is received from PersonaPlex */
  audio: [data: Buffer];
  /** Emitted when text is received (transcript) */
  text: [text: string];
  /** Emitted on handshake completion */
  ready: [];
  /** Emitted for any message */
  message: [message: PersonaPlexMessage];
}

/**
 * PersonaPlex WebSocket Client
 * 
 * @example
 * ```typescript
 * const client = new PersonaPlexClient({
 *   config: {
 *     url: 'wss://localhost:8998/api/chat',
 *     voicePrompt: 'NATF2.pt',
 *     textPrompt: 'You are a helpful assistant.',
 *   }
 * });
 * 
 * client.on('audio', (data) => {
 *   // Handle received audio (Opus encoded)
 * });
 * 
 * client.on('text', (text) => {
 *   console.log('AI said:', text);
 * });
 * 
 * await client.connect();
 * 
 * // Send audio from user
 * client.sendAudio(opusEncodedBuffer);
 * ```
 */
export class PersonaPlexClient extends EventEmitter<PersonaPlexClientEvents> {
  private ws: WebSocket | null = null;
  private readonly config: PersonaPlexConfig;
  private readonly autoReconnect: boolean;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelay: number;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  private isReady: boolean = false;
  private shouldReconnect: boolean = true;

  constructor(options: PersonaPlexClientOptions) {
    super();
    this.config = options.config;
    this.autoReconnect = options.autoReconnect ?? false;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 1000;
  }

  /**
   * Connect to PersonaPlex server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; 
    }

    if (this.isConnecting) {
      return; 
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    // Reset attempts if starting a fresh connection flow (optional, but good for "startSession")
    // Note: We don't reset this.reconnectAttempts here because we want to track retries across the flow
    // But for a fresh "connect()" call from outside, we usually start from 0.
    this.reconnectAttempts = 0;

    return this.connectInternal();
  }

  private async connectInternal(): Promise<void> {
     return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.config.url);
        url.searchParams.set('voice_prompt', this.config.voicePrompt);
        url.searchParams.set('text_prompt', this.config.textPrompt);

        this.ws = new WebSocket(url.toString(), {
          rejectUnauthorized: false,
        });

        this.ws.binaryType = 'nodebuffer';

        this.ws.on('open', () => {
          // Connected!
          this.reconnectAttempts = 0; // Reset counter on success
          this.emit('connected');
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data, resolve);
        });

        this.ws.on('error', (error) => {
          // Error handling is tricky during connection vs after
          this.emit('error', error);
        });

        this.ws.on('close', (code, reason) => {
           // If we closed BEFORE being ready (handshake), it's a connection failure.
           // If we were already ready, it's a disconnect.
           
           if (!this.isReady) {
               // Initial connection failed
               if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                   this.reconnectAttempts++;
                   const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts); // milder backoff
                   console.log(`[PersonaPlex] Connection failed, retrying in ${delay}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                   
                   this.ws = null; // Cleanup
                   setTimeout(() => {
                        this.connectInternal().then(resolve).catch(reject);
                   }, delay);
               } else {
                   this.isConnecting = false;
                   reject(new Error(`Failed to connect after ${this.reconnectAttempts} attempts: Connection closed`));
               }
           } else {
               // Normal disconnect logic
               this.isConnecting = false;
               this.isReady = false;
               this.emit('disconnected', reason?.toString() ?? `Code: ${code}`);
               
               if (this.autoReconnect && this.shouldReconnect) {
                   this.attemptReconnect();
               }
           }
        });

        // Fail-safe timeout for this specific attempt
        // We only reject if we run out of retries, so we don't reject here usually
        // unless it hangs completely.

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: Buffer, resolveConnect?: (value: void) => void): void {
    const message = decodeMessage(data);
    this.emit('message', message);

    switch (message.type) {
      case 'handshake':
        this.isReady = true;
        this.emit('ready');
        resolveConnect?.();
        break;

      case 'audio':
        this.emit('audio', message.data);
        break;

      case 'text':
        this.emit('text', message.data);
        break;

      case 'error':
        this.emit('error', new Error(message.data));
        break;
    }
  }

  /**
   * Attempt to reconnect after disconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (error) {
      // Will trigger another reconnect attempt via close handler
    }
  }

  /**
   * Send audio data to PersonaPlex
   * 
   * @param opusData - Opus encoded audio data
   */
  sendAudio(opusData: Buffer): void {
    if (!this.isReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Client is not connected');
    }

    const message = encodeAudioMessage(opusData);
    this.ws.send(message);
  }

  /**
   * Check if client is connected and ready
   */
  get connected(): boolean {
    return this.isReady && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    this.shouldReconnect = false;
    
    if (this.ws) {
      return new Promise((resolve) => {
        if (!this.ws) {
          resolve();
          return;
        }

        this.ws.once('close', () => {
          this.ws = null;
          this.isReady = false;
          resolve();
        });

        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        } else {
          this.ws = null;
          this.isReady = false;
          resolve();
        }
      });
    }
  }
}
