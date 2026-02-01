/**
 * TwiML (Twilio Markup Language) generators
 * 
 * TwiML is XML that tells Twilio how to handle calls.
 */

/**
 * Generate TwiML to start a Media Stream
 * 
 * @param wsUrl - WebSocket URL for the media stream (must be wss://)
 * @param welcomeMessage - Optional message to say before starting the stream
 * @returns TwiML XML string
 * 
 * @example
 * ```typescript
 * const twiml = generateStreamTwiml('wss://example.com/media-stream');
 * // Returns XML that connects the call to your WebSocket
 * ```
 */
export function generateStreamTwiml(wsUrl: string, welcomeMessage?: string): string {
  const sayElement = welcomeMessage 
    ? `<Say voice="Polly.Joanna">${escapeXml(welcomeMessage)}</Say>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayElement}
  <Connect>
    <Stream url="${escapeXml(wsUrl)}">
      <Parameter name="codec" value="audio/x-mulaw"/>
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Generate TwiML to say a message
 * 
 * @param message - Message to speak
 * @param voice - Twilio voice to use (default: Polly.Joanna)
 * @returns TwiML XML string
 */
export function generateSayTwiml(message: string, voice: string = 'Polly.Joanna'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voice)}">${escapeXml(message)}</Say>
</Response>`;
}

/**
 * Generate TwiML to say something and then hang up
 */
export function generateSayAndHangupTwiml(message: string, voice: string = 'Polly.Joanna'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(voice)}">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Escape special XML characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
