type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const resolveLevel = (): LogLevel => {
  const raw = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (raw && raw in LEVEL_VALUES) {
    return raw;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

const activeLevel = resolveLevel();

const shouldLog = (level: LogLevel) => LEVEL_VALUES[level] >= LEVEL_VALUES[activeLevel];

const toPlainObject = (value: unknown) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === 'object') {
    return JSON.parse(JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val)));
  }

  return value;
};

export interface LogMetadata {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  child(metadata?: LogMetadata): Logger;
}

const output = (level: LogLevel, payload: Record<string, unknown>) => {
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
};

const buildLogger = (context: LogMetadata): Logger => {
  const withContext = (metadata?: LogMetadata) => ({
    ...context,
    ...(metadata ?? {}),
  });

  const log = (level: LogLevel, message: string, metadata?: LogMetadata) => {
    if (!shouldLog(level)) {
      return;
    }

    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...withContext(),
    };

    if (metadata && Object.keys(metadata).length > 0) {
      Object.entries(metadata).forEach(([key, value]) => {
        payload[key] = toPlainObject(value);
      });
    }

    output(level, payload);
  };

  return {
    debug: (message, metadata) => log('debug', message, metadata),
    info: (message, metadata) => log('info', message, metadata),
    warn: (message, metadata) => log('warn', message, metadata),
    error: (message, metadata) => log('error', message, metadata),
    child: (metadata) => buildLogger(withContext(metadata)),
  };
};

export const logger = buildLogger({ service: 'autotrace-api' });

export const createLogger = (metadata?: LogMetadata) => buildLogger({ service: 'autotrace-api', ...(metadata ?? {}) });
