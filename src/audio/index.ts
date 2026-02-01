/**
 * Audio utilities module
 */

export * from './converter.js';
export * from './resampler.js';
export * from './buffer.js';
export * from './opus.js'; // Export Opus utilities

export const TWILIO_SAMPLE_RATE = 8000;
export const PERSONAPLEX_SAMPLE_RATE = 24000;
export const FRAME_SIZE_MS = 80; // PersonaPlex frame size
