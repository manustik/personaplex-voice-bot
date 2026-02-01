/**
 * Opus Audio Codec Utilities
 * 
 * Handles encoding/decoding of audio frames using opusscript (WebAssembly).
 * 
 * Configured for:
 * - Sample Rate: 24000 Hz (PersonaPlex native)
 * - Channels: 1 (Mono)
 * - Frame Size: 20ms (480 samples) or determined by usage
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const OpusScript = require('opusscript');

// Define minimal type for OpusScript instance since we are requiring it
interface OpusScriptInstance {
  encode(buffer: Buffer, frameSize: number): Buffer;
  decode(buffer: Buffer): Buffer;
  delete(): void;
}

const SAMPLE_RATE = 24000;
const CHANNELS = 1;

// Application types from opus definition
const APPLICATION_VOIP = 2048;

export class OpusCodec {
  private encoder: OpusScriptInstance;
  private decoder: OpusScriptInstance;

  constructor() {
    // Initialize Encoder
    // Application: VOIP (optimized for voice)
    this.encoder = new OpusScript(SAMPLE_RATE, CHANNELS, APPLICATION_VOIP);

    // Initialize Decoder
    this.decoder = new OpusScript(SAMPLE_RATE, CHANNELS);
  }

  /**
   * Encode PCM Float32 audio to Opus
   * 
   * @param pcm - Float32Array of audio samples
   * @returns Buffer containing Opus encoded packet
   */
  encode(pcm: Float32Array): Buffer {
    // OpusScript expects Int16 input (Buffer)
    const pcm16 = this.float32ToInt16(pcm);
    
    // encode returns a Buffer
    // We pass the number of samples per channel (frame size)
    return this.encoder.encode(pcm16, pcm.length); 
  }

  /**
   * Decode Opus packet to PCM Float32
   * 
   * @param opus - Buffer containing Opus packet
   * @returns Float32Array of decoded audio samples
   */
  decode(opus: Buffer): Float32Array {
    // Decode to Int16 Buffer
    const decodedBuffer = this.decoder.decode(opus);
    
    // Convert back to Float32
    return this.int16ToFloat32(decodedBuffer);
  }

  /**
   * Helper: Convert Float32Array to Int16 Buffer
   */
  private float32ToInt16(float32: Float32Array): Buffer {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]!));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return Buffer.from(int16.buffer);
  }

  /**
   * Helper: Convert Int16 Buffer to Float32Array
   */
  private int16ToFloat32(buffer: Buffer): Float32Array { // Int16 Buffer
    const int16 = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        const int = int16[i]!;
        // Standard normalization
        float32[i] = int / 32768.0; 
    }
    return float32;
  }
  
  /**
   * Clean up resources
   */
  delete(): void {
      this.encoder.delete();
      this.decoder.delete();
  }
}
