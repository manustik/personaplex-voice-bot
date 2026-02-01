/**
 * G.711 mu-law encoder/decoder
 * Adapted for browser usage
 */

const BIAS = 0x84;
const CLIP = 32635;

const muLawEncodeTable = new Uint8Array(256);
const muLawDecodeTable = new Int16Array(256);

// Initialize tables
(function initTables() {
    for (let i = 0; i < 256; i++) {
        let mu = 255 - i;
        let t = ((mu & 0xf) << 3) + BIAS;
        t <<= (mu & 0x70) >> 4;
        muLawDecodeTable[i] = (i & 0x80) ? (BIAS - t) : (t - BIAS);
    }
})();

export function encodeMuLaw(sample) {
    let sign = (sample < 0) ? 0x80 : 0;
    if (sample < 0) sample = -sample;
    sample = Math.min(sample, CLIP);
    sample += BIAS;
    
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
        exponent--;
    }
    
    let mantissa = (sample >> (exponent + 3)) & 0x0f;
    return ~(sign | (exponent << 4) | mantissa);
}

export function decodeMuLaw(muLawByte) {
    return muLawDecodeTable[muLawByte];
}

/**
 * Encode Float32Array to mu-law Uint8Array
 */
export function encode(pcmFloat32) {
    const uint8 = new Uint8Array(pcmFloat32.length);
    for (let i = 0; i < pcmFloat32.length; i++) {
        const s = Math.max(-1, Math.min(1, pcmFloat32[i]));
        const s16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
        uint8[i] = encodeMuLaw(Math.floor(s16));
    }
    return uint8;
}

/**
 * Decode mu-law Uint8Array to Float32Array
 */
export function decode(muLawBuffer) {
    const float32 = new Float32Array(muLawBuffer.length);
    for (let i = 0; i < muLawBuffer.length; i++) {
        const s16 = decodeMuLaw(muLawBuffer[i]);
        float32[i] = s16 / 32768.0;
    }
    return float32;
}
