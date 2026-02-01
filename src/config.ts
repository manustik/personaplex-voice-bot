import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

/**
 * Configuration for PersonaPlex connection
 */
export interface PersonaPlexConfig {
  /** WebSocket URL for PersonaPlex server (e.g., wss://localhost:8998/api/chat) */
  url: string;
  /** Voice prompt file name (e.g., NATF2.pt, NATM1.pt) */
  voicePrompt: string;
  /** Text prompt for the AI persona/role */
  textPrompt: string;
}

/**
 * Configuration for Twilio integration
 */
export interface TwilioConfig {
  /** Twilio Account SID */
  accountSid: string;
  /** Twilio Auth Token */
  authToken: string;
}

/**
 * Configuration for the bridge server
 */
export interface ServerConfig {
  /** Server port */
  port: number;
  /** Server host */
  host: string;
}

/**
 * Complete configuration for the Voice Bot
 */
export interface VoiceBotConfig {
  /** PersonaPlex connection settings */
  personaplex: PersonaPlexConfig;
  /** Twilio settings (optional for local testing) */
  twilio?: TwilioConfig;
  /** Bridge server settings */
  server: ServerConfig;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): VoiceBotConfig {
  return {
    personaplex: {
      url: process.env['PERSONAPLEX_URL'] ?? 'wss://localhost:8998/api/chat',
      voicePrompt: process.env['PERSONAPLEX_VOICE_PROMPT'] ?? 'NATF2.pt',
      textPrompt: process.env['PERSONAPLEX_TEXT_PROMPT'] ?? 'You enjoy having a good conversation.',
    },
    twilio: process.env['TWILIO_ACCOUNT_SID'] && process.env['TWILIO_AUTH_TOKEN']
      ? {
          accountSid: process.env['TWILIO_ACCOUNT_SID'],
          authToken: process.env['TWILIO_AUTH_TOKEN'],
        }
      : undefined,
    server: {
      port: parseInt(process.env['SERVER_PORT'] ?? '3000', 10),
      host: process.env['SERVER_HOST'] ?? '0.0.0.0',
    },
    logLevel: (process.env['LOG_LEVEL'] as VoiceBotConfig['logLevel']) ?? 'info',
  };
}

/**
 * Create a configuration object with custom values
 */
export function createConfig(partial: Partial<VoiceBotConfig>): VoiceBotConfig {
  const defaults = loadConfig();
  return {
    ...defaults,
    ...partial,
    personaplex: {
      ...defaults.personaplex,
      ...partial.personaplex,
    },
    server: {
      ...defaults.server,
      ...partial.server,
    },
    twilio: partial.twilio ?? defaults.twilio,
  };
}
