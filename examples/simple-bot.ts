/**
 * Simple Bot Example
 * 
 * This example starts the bridge server for use with Twilio.
 * 
 * Usage:
 *   1. Start PersonaPlex server:
 *      cd personaplex && python -m moshi.server --ssl "$SSL_DIR" --cpu-offload
 * 
 *   2. Run this server:
 *      npx tsx examples/simple-bot.ts
 * 
 *   3. Expose with ngrok:
 *      ngrok http 3000
 * 
 *   4. Configure Twilio:
 *      - Go to your Twilio phone number settings
 *      - Set the webhook for incoming calls to: https://your-ngrok-url.ngrok.io/twiml
 *      - Method: HTTP POST
 * 
 *   5. Call your Twilio number!
 */

import { startServer } from '../src/server/index.js';
import { loadConfig, createConfig } from '../src/config.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('simple-bot');

async function main() {
  logger.info('Starting Voice Bot server...');
  
  // Load config from environment
  const config = createConfig({
    // You can override config here if needed
    personaplex: {
      url: process.env['PERSONAPLEX_URL'] ?? 'wss://localhost:8998/api/chat',
      voicePrompt: process.env['PERSONAPLEX_VOICE_PROMPT'] ?? 'NATF2.pt',
      textPrompt: process.env['PERSONAPLEX_TEXT_PROMPT'] ?? 
        'You are a helpful customer service assistant. Be friendly and concise.',
    },
    server: {
      port: parseInt(process.env['PORT'] ?? '3000', 10),
      host: '0.0.0.0',
    },
  });

  logger.info({
    personaplexUrl: config.personaplex.url,
    voice: config.personaplex.voicePrompt,
    serverPort: config.server.port,
  }, 'Configuration');

  // Start server
  const server = await startServer(config);

  logger.info('');
  logger.info('='.repeat(60));
  logger.info('Voice Bot Server is running!');
  logger.info('='.repeat(60));
  logger.info('');
  logger.info('Next steps:');
  logger.info('1. Make sure PersonaPlex server is running');
  logger.info('2. Expose this server with ngrok: ngrok http 3000');
  logger.info('3. Configure Twilio webhook to: https://<ngrok-url>/twiml');
  logger.info('4. Call your Twilio number!');
  logger.info('');
  logger.info('Endpoints:');
  logger.info(`  TwiML: http://localhost:${config.server.port}/twiml`);
  logger.info(`  Health: http://localhost:${config.server.port}/health`);
  logger.info(`  Media Stream: ws://localhost:${config.server.port}/media-stream`);
  logger.info('');

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
