/**
 * Local Test Example with Audio Recording
 * 
 * Connects to PersonaPlex (or Mock Server) and records received audio to a file.
 * 
 * Usage:
 *   npx tsx examples/local-test.ts
 */

import fs from 'fs';
import path from 'path';
import { PersonaPlexClient } from '../src/personaplex/client.js';
import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('local-test');
const OUTPUT_FILE = path.resolve('test_output.pcm'); // Raw PCM Float32

async function main() {
  logger.info('Starting local PersonaPlex test...');
  
  // Clean up previous output
  if (fs.existsSync(OUTPUT_FILE)) {
    fs.unlinkSync(OUTPUT_FILE);
  }
  
  const fileStream = fs.createWriteStream(OUTPUT_FILE);
  
  const config = loadConfig();
  
  logger.info({
    url: config.personaplex.url,
    outputFile: OUTPUT_FILE,
  }, 'Configuration');

  const client = new PersonaPlexClient({
    config: config.personaplex,
  });

  client.on('connected', () => {
    logger.info('Connected to server');
  });

  client.on('ready', () => {
    logger.info('✅ Ready! Waiting for audio...');
  });

  let totalBytes = 0;

  client.on('audio', (data) => {
    // Write received audio directly to file
    // Note: If using real PersonaPlex, this is Opus encoded.
    // If using Mock Server, this is raw Float32 PCM (because we hacked it).
    fileStream.write(data);
    totalBytes += data.length;
    
    if (totalBytes % (1920 * 4 * 10) === 0) { // Log every ~10 frames
       logger.info({ totalBytes }, 'Receiving audio...');
    }
  });

  client.on('text', (text) => {
    logger.info({ text }, '💬 Server said');
  });

  client.on('error', (error) => {
    logger.error({ error: error.message }, 'Error');
  });

  client.on('disconnected', () => {
    logger.info('Disconnected');
    fileStream.end();
  });

  try {
    await client.connect();
  } catch (error) {
    logger.error({ error }, 'Failed to connect');
    process.exit(1);
  }

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await client.close();
    fileStream.end();
    logger.info(`\nAudio saved to: ${OUTPUT_FILE}`);
    logger.info('To play this file: Import as Raw Data (Float32, Little-endian, 24000Hz) in Audacity');
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
