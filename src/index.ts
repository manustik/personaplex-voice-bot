/**
 * Voice Bot Module
 * 
 * A modular TypeScript library for integrating PersonaPlex with Twilio Media Streams
 * to create real-time voice conversation bots.
 * 
 * @packageDocumentation
 */

// Configuration
export { VoiceBotConfig, loadConfig, createConfig } from './config.js';

// PersonaPlex Client
export { PersonaPlexClient } from './personaplex/index.js';
export type { PersonaPlexConfig, PersonaPlexMessage } from './personaplex/index.js';

// Twilio Integration
export { TwilioMediaHandler, generateStreamTwiml } from './twilio/index.js';
export type { TwilioMediaMessage } from './twilio/index.js';

// Audio Utilities
export * from './audio/index.js';

// Server
export { startServer, createServer } from './server/index.js';

// Main VoiceBot class
export { VoiceBot } from './voice-bot.js';
