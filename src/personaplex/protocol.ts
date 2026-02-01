/**
 * PersonaPlex WebSocket Protocol
 * 
 * Message format (binary):
 * - Byte 0: Message type
 * - Bytes 1+: Payload
 * 
 * Based on the original PersonaPlex client implementation.
 */

/**
 * Message type identifiers
 */
export const MessageType = {
  /** Connection handshake (server → client) */
  HANDSHAKE: 0x00,
  /** Audio data (bidirectional, Opus encoded) */
  AUDIO: 0x01,
  /** Text transcript (server → client) */
  TEXT: 0x02,
  /** Control messages */
  CONTROL: 0x03,
  /** Metadata */
  METADATA: 0x04,
  /** Error */
  ERROR: 0x05,
  /** Ping/keepalive */
  PING: 0x06,
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/**
 * Decoded PersonaPlex message
 */
export type PersonaPlexMessage = 
  | { type: 'handshake' }
  | { type: 'audio'; data: Buffer }
  | { type: 'text'; data: string }
  | { type: 'control'; action: string }
  | { type: 'metadata'; data: unknown }
  | { type: 'error'; data: string }
  | { type: 'ping' }
  | { type: 'unknown'; rawType: number };

/**
 * Encode audio data for sending to PersonaPlex
 * 
 * @param opusData - Opus encoded audio data
 * @returns Buffer ready to send via WebSocket
 */
export function encodeAudioMessage(opusData: Buffer): Buffer {
  const message = Buffer.alloc(opusData.length + 1);
  message[0] = MessageType.AUDIO;
  opusData.copy(message, 1);
  return message;
}

/**
 * Decode a message received from PersonaPlex
 * 
 * @param data - Raw binary message from WebSocket
 * @returns Decoded message object
 */
export function decodeMessage(data: Buffer): PersonaPlexMessage {
  if (data.length === 0) {
    return { type: 'unknown', rawType: -1 };
  }

  const messageType = data[0];
  const payload = data.subarray(1);

  switch (messageType) {
    case MessageType.HANDSHAKE:
      return { type: 'handshake' };

    case MessageType.AUDIO:
      return { type: 'audio', data: Buffer.from(payload) };

    case MessageType.TEXT:
      return { type: 'text', data: payload.toString('utf-8') };

    case MessageType.CONTROL:
      return { type: 'control', action: decodeControlAction(payload[0]) };

    case MessageType.METADATA:
      try {
        return { type: 'metadata', data: JSON.parse(payload.toString('utf-8')) };
      } catch {
        return { type: 'metadata', data: null };
      }

    case MessageType.ERROR:
      return { type: 'error', data: payload.toString('utf-8') };

    case MessageType.PING:
      return { type: 'ping' };

    default:
      return { type: 'unknown', rawType: messageType ?? -1 };
  }
}

/**
 * Encode a text message (for sending prompts, etc.)
 */
export function encodeTextMessage(text: string): Buffer {
  const textBytes = Buffer.from(text, 'utf-8');
  const message = Buffer.alloc(textBytes.length + 1);
  message[0] = MessageType.TEXT;
  textBytes.copy(message, 1);
  return message;
}

/**
 * Control message actions
 */
const ControlActions: Record<number, string> = {
  0x00: 'start',
  0x01: 'endTurn',
  0x02: 'pause',
  0x03: 'restart',
};

function decodeControlAction(code: number | undefined): string {
  return ControlActions[code ?? -1] ?? 'unknown';
}
