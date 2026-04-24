import pino from 'pino';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Structured JSON logger, Loki/Grafana-friendly.
// Fields: level (numeric + string), time (ISO), msg, service, plus any bindings.
// Override with LOG_LEVEL=debug|info|warn|error|fatal. Set LOG_PRETTY=1 for dev console output.
export const logger = pino({
  level,
  base: { service: 'home-lighting' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label, number) => ({ level: label, levelValue: number }),
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[redacted]',
  },
  ...(process.env.LOG_PRETTY === '1'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } } }
    : {}),
});

export type Logger = typeof logger;

/** Create a child logger scoped to a module/component. */
export function child(component: string, bindings: Record<string, unknown> = {}): Logger {
  return logger.child({ component, ...bindings });
}
