/**
 * Server Entry Point
 */

import { startServer } from './app.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('server-start');

logger.info('Starting server...');

startServer().catch((error) => {
  logger.error({ error }, 'Fatal error starting server');
  process.exit(1);
});
