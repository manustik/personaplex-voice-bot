/**
 * Audio format conversion utilities
 * 
 * Handles conversion between:
 * - PCM Float32 (internal processing format)
 * - mu-law (Twilio telephone audio format)
 */

// mu-law encoding constants
export const MULAW_BIAS = 0x84;
export const MULAW_MAX = 32635;

// mu-law to linear PCM lookup table
const MULAW_DECODE_TABLE = new Int16Array([
  -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
  -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
  -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
  -11900, -11388, -10876, -10364,  -9852,  -9340,  -8828,  -8316,
   -7932,  -7676,  -7420,  -7164,  -6908,  -6652,  -6396,  -6140,
   -5884,  -5628,  -5372,  -5116,  -4860,  -4604,  -4348,  -4092,
   -3900,  -3772,  -3644,  -3516,  -3388,  -3260,  -3132,  -3004,
   -2876,  -2748,  -2620,  -2492,  -2364,  -2236,  -2108,  -1980,
   -1884,  -1820,  -1756,  -1692,  -1628,  -1564,  -1500,  -1436,
   -1372,  -1308,  -1244,  -1180,  -1116,  -1052,   -988,   -924,
    -876,   -844,   -812,   -780,   -748,   -716,   -684,   -652,
    -620,   -588,   -556,   -524,   -492,   -460,   -428,   -396,
    -372,   -356,   -340,   -324,   -308,   -292,   -276,   -260,
    -244,   -228,   -212,   -196,   -180,   -164,   -148,   -132,
    -120,   -112,   -104,    -96,    -88,    -80,    -72,    -64,
     -56,    -48,    -40,    -32,    -24,    -16,     -8,      0,
   32124,  31100,  30076,  29052,  28028,  27004,  25980,  24956,
   23932,  22908,  21884,  20860,  19836,  18812,  17788,  16764,
   15996,  15484,  14972,  14460,  13948,  13436,  12924,  12412,
   11900,  11388,  10876,  10364,   9852,   9340,   8828,   8316,
    7932,   7676,   7420,   7164,   6908,   6652,   6396,   6140,
    5884,   5628,   5372,   5116,   4860,   4604,   4348,   4092,
    3900,   3772,   3644,   3516,   3388,   3260,   3132,   3004,
    2876,   2748,   2620,   2492,   2364,   2236,   2108,   1980,
    1884,   1820,   1756,   1692,   1628,   1564,   1500,   1436,
    1372,   1308,   1244,   1180,   1116,   1052,    988,    924,
     876,    844,    812,    780,    748,    716,    684,    652,
     620,    588,    556,    524,    492,    460,    428,    396,
     372,    356,    340,    324,    308,    292,    276,    260,
     244,    228,    212,    196,    180,    164,    148,    132,
     120,    112,    104,     96,     88,     80,     72,     64,
      56,     48,     40,     32,     24,     16,      8,      0,
]);

/**
 * Encode a single PCM sample to mu-law
 */
function encodeMulawSample(sample: number): number {
  // Clamp to [-1, 1] and convert to 16-bit range
  const clamped = Math.max(-1, Math.min(1, sample));
  let pcm = Math.round(clamped * 32767);
  
  // Get the sign
  const sign = (pcm < 0) ? 0x80 : 0x00;
  if (pcm < 0) pcm = -pcm;
  
  // Add bias
  pcm = Math.min(pcm + MULAW_BIAS, MULAW_MAX);
  
  // Find the segment
  let exponent = 7;
  let mask = 0x4000;
  while ((pcm & mask) === 0 && exponent > 0) {
    exponent--;
    mask >>= 1;
  }
  
  // Extract mantissa
  const mantissa = (pcm >> (exponent + 3)) & 0x0F;
  
  // Combine and complement
  return ~(sign | (exponent << 4) | mantissa) & 0xFF;
}

/**
 * Convert PCM Float32 audio to mu-law encoded bytes
 * 
 * @param pcm - Float32Array with values in range [-1, 1]
 * @returns Buffer with mu-law encoded audio
 */
export function pcmToMulaw(pcm: Float32Array): Buffer {
  const mulaw = Buffer.alloc(pcm.length);
  
  for (let i = 0; i < pcm.length; i++) {
    mulaw[i] = encodeMulawSample(pcm[i]!);
  }
  
  return mulaw;
}

/**
 * Convert mu-law encoded bytes to PCM Float32 audio
 * 
 * @param mulaw - Buffer with mu-law encoded audio
 * @returns Float32Array with values in range [-1, 1]
 */
export function mulawToPcm(mulaw: Buffer): Float32Array {
  const pcm = new Float32Array(mulaw.length);
  
  for (let i = 0; i < mulaw.length; i++) {
    // Lookup and normalize to [-1, 1]
    pcm[i] = MULAW_DECODE_TABLE[mulaw[i]!]! / 32768;
  }
  
  return pcm;
}

/**
 * Convert Int16 PCM to Float32 PCM
 */
export function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i]! / 32768;
  }
  return float32;
}

/**
 * Convert Float32 PCM to Int16 PCM
 */
export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]!));
    int16[i] = Math.round(sample * 32767);
  }
  return int16;
}
