import { createLogger, format, transports } from 'winston';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = createLogger({
  level,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.colorize({ all: true }),
    format.printf(({ timestamp, level: lvl, message, ...meta }) => {
      const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${lvl}] ${message}${metaString}`;
    }),
  ),
  transports: [new transports.Console()],
});
