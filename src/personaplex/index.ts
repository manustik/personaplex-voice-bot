/**
 * PersonaPlex client module
 */

export { PersonaPlexClient } from './client.js';
export type { PersonaPlexClientOptions } from './client.js';
export { 
  MessageType, 
  encodeAudioMessage, 
  decodeMessage,
  type PersonaPlexMessage,
} from './protocol.js';
export type { PersonaPlexConfig } from '../config.js';
