/**
 * Audio resampling utilities
 * 
 * Handles sample rate conversion between:
 * - Twilio: 8000 Hz
 * - PersonaPlex: 24000 Hz
 */

export interface Resampler {
  /** Resample audio from source to target sample rate */
  process(input: Float32Array): Float32Array;
  /** Reset the resampler state */
  reset(): void;
}

/**
 * Simple linear interpolation resampler
 * 
 * For production, consider using a higher quality resampler like libsamplerate.
 * This implementation is sufficient for voice audio and testing.
 */
class LinearResampler implements Resampler {
  private readonly ratio: number;
  private fractionalPosition: number = 0;

  constructor(
    private readonly fromRate: number,
    private readonly toRate: number
  ) {
    this.ratio = fromRate / toRate;
  }

  process(input: Float32Array): Float32Array {
    if (this.fromRate === this.toRate) {
      return input;
    }

    const outputLength = Math.ceil(input.length / this.ratio);
    const output = new Float32Array(outputLength);
    
    let inputIndex = 0;
    let outputIndex = 0;
    
    while (outputIndex < outputLength && inputIndex < input.length) {
      // Linear interpolation between samples
      const currentSample = input[inputIndex] ?? 0;
      const nextSample = input[Math.min(inputIndex + 1, input.length - 1)] ?? currentSample;
      
      output[outputIndex] = currentSample + (nextSample - currentSample) * this.fractionalPosition;
      
      this.fractionalPosition += this.ratio;
      
      while (this.fractionalPosition >= 1) {
        this.fractionalPosition -= 1;
        inputIndex++;
      }
      
      outputIndex++;
    }
    
    return output.slice(0, outputIndex);
  }

  reset(): void {
    this.fractionalPosition = 0;
  }
}

/**
 * Create a resampler instance
 */
export function createResampler(fromRate: number, toRate: number): Resampler {
  return new LinearResampler(fromRate, toRate);
}

/**
 * One-shot resampling function (stateless)
 * 
 * @param audio - Input audio samples
 * @param fromRate - Original sample rate
 * @param toRate - Target sample rate
 * @returns Resampled audio
 */
export function resample(
  audio: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) {
    return audio;
  }

  const ratio = fromRate / toRate;
  const outputLength = Math.ceil(audio.length / ratio);
  const output = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const srcPosition = i * ratio;
    const srcIndex = Math.floor(srcPosition);
    const fraction = srcPosition - srcIndex;
    
    const sample1 = audio[srcIndex] ?? 0;
    const sample2 = audio[Math.min(srcIndex + 1, audio.length - 1)] ?? sample1;
    
    // Linear interpolation
    output[i] = sample1 + (sample2 - sample1) * fraction;
  }
  
  return output;
}

/**
 * Convenience function: Resample from Twilio (8kHz) to PersonaPlex (24kHz)
 */
export function resampleToPersonaPlex(audio: Float32Array): Float32Array {
  return resample(audio, 8000, 24000);
}

/**
 * Convenience function: Resample from PersonaPlex (24kHz) to Twilio (8kHz)
 */
export function resampleToTwilio(audio: Float32Array): Float32Array {
  return resample(audio, 24000, 8000);
}
