/**
 * Audio buffer manager for accumulating audio frames
 * 
 * PersonaPlex processes audio in 80ms frames at 24kHz (1920 samples per frame).
 * Twilio sends audio in 20ms chunks at 8kHz (160 samples per chunk).
 * 
 * This buffer accumulates Twilio chunks until we have enough for a PersonaPlex frame.
 */

export class AudioBuffer {
  private buffer: Float32Array;
  private writePosition: number = 0;
  private readonly frameSize: number;

  /**
   * Create an audio buffer
   * @param frameSize - Number of samples per output frame
   * @param maxFrames - Maximum number of frames to buffer (for memory safety)
   */
  constructor(frameSize: number, maxFrames: number = 10) {
    this.frameSize = frameSize;
    this.buffer = new Float32Array(frameSize * maxFrames);
  }

  /**
   * Add audio samples to the buffer
   */
  push(samples: Float32Array): void {
    // Check if we have space
    if (this.writePosition + samples.length > this.buffer.length) {
      // Shift buffer to make room (drop oldest samples)
      const overflow = this.writePosition + samples.length - this.buffer.length;
      this.buffer.copyWithin(0, overflow);
      this.writePosition -= overflow;
    }

    // Copy new samples
    this.buffer.set(samples, this.writePosition);
    this.writePosition += samples.length;
  }

  /**
   * Check if we have at least one complete frame
   */
  hasFrame(): boolean {
    return this.writePosition >= this.frameSize;
  }

  /**
   * Get the number of complete frames available
   */
  frameCount(): number {
    return Math.floor(this.writePosition / this.frameSize);
  }

  /**
   * Get the number of samples currently buffered
   */
  sampleCount(): number {
    return this.writePosition;
  }

  /**
   * Read one frame from the buffer (removes it from buffer)
   * Returns null if no complete frame is available
   */
  readFrame(): Float32Array | null {
    if (!this.hasFrame()) {
      return null;
    }

    // Extract frame
    const frame = this.buffer.slice(0, this.frameSize);
    
    // Shift remaining samples
    this.buffer.copyWithin(0, this.frameSize);
    this.writePosition -= this.frameSize;

    return frame;
  }

  /**
   * Read all available complete frames
   */
  readAllFrames(): Float32Array[] {
    const frames: Float32Array[] = [];
    let frame = this.readFrame();
    while (frame !== null) {
      frames.push(frame);
      frame = this.readFrame();
    }
    return frames;
  }

  /**
   * Peek at buffered samples without removing them
   */
  peek(count?: number): Float32Array {
    const length = count ?? this.writePosition;
    return this.buffer.slice(0, Math.min(length, this.writePosition));
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.writePosition = 0;
  }

  /**
   * Get buffer fill level as a percentage (0-100)
   */
  fillLevel(): number {
    return (this.writePosition / this.buffer.length) * 100;
  }
}

/**
 * Create a buffer suited for PersonaPlex frame accumulation
 * 
 * PersonaPlex uses 80ms frames at 24kHz = 1920 samples per frame
 */
export function createPersonaPlexBuffer(): AudioBuffer {
  const PERSONAPLEX_FRAME_SIZE = 1920; // 80ms at 24kHz
  return new AudioBuffer(PERSONAPLEX_FRAME_SIZE);
}

/**
 * Create a buffer suited for Twilio audio output
 * 
 * Twilio expects 20ms chunks at 8kHz = 160 samples per chunk
 */
export function createTwilioBuffer(): AudioBuffer {
  const TWILIO_CHUNK_SIZE = 160; // 20ms at 8kHz
  return new AudioBuffer(TWILIO_CHUNK_SIZE);
}
