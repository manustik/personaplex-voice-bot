/**
 * Logging utilities using Pino
 * 
 * Provides structured JSON logging with optional pretty printing.
 */

import pino from 'pino';

export type Logger = pino.Logger;

/**
 * Create a logger instance
 */
export function createLogger(name: string, level?: string): Logger {
  const isPretty = process.env['NODE_ENV'] !== 'production';
  
  return pino({
    name,
    level: level ?? process.env['LOG_LEVEL'] ?? 'info',
    transport: isPretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger('voice-bot');
