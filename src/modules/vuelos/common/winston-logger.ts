import { join } from 'node:path';
import { ConsoleLogger, LogLevel, LoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger as Winston } from 'winston';
import { currentCorrelationId } from './correlation';

/**
 * Technical logs. The console keeps Nest's readable output; in addition every line goes, as one JSON object with its
 * correlation id, to `logs/combined.log` (everything), `logs/error.log` (errors) and, for the audit trail,
 * `logs/audit.log`. Files rotate by size. `LOG_TO_FILES=false` turns the files off; `LOG_DIR` moves them.
 */
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

let auditWriter: Winston | null = null;

/** One line in the audit log (domain events). A no-op until the file logger is created, so tests and scripts never write files. */
export function escribirAuditoria(entry: Record<string, unknown>): void {
  auditWriter?.info('audit', entry);
}

export class WinstonLogger extends ConsoleLogger implements LoggerService {
  private readonly files: Winston | null;

  constructor(levels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose']) {
    super();
    this.setLogLevels(levels);
    if (process.env.LOG_TO_FILES === 'false') {
      this.files = null;
      return;
    }
    const dir = process.env.LOG_DIR ?? join(process.cwd(), 'logs');
    const archivo = (filename: string, level?: string) => new transports.File({ filename: join(dir, filename), level, maxsize: MAX_BYTES, maxFiles: MAX_FILES, tailable: true });
    const formato = format.combine(format.timestamp(), format.json());
    this.files = createLogger({ level: 'debug', format: formato, transports: [archivo('combined.log'), archivo('error.log', 'error')] });
    auditWriter = createLogger({ level: 'info', format: formato, transports: [archivo('audit.log')] });
  }

  override log(message: unknown, ...optional: unknown[]): void {
    super.log(message, ...optional);
    this.write('info', message, optional);
  }

  override error(message: unknown, ...optional: unknown[]): void {
    super.error(message, ...optional);
    this.write('error', message, optional);
  }

  override warn(message: unknown, ...optional: unknown[]): void {
    super.warn(message, ...optional);
    this.write('warn', message, optional);
  }

  override debug(message: unknown, ...optional: unknown[]): void {
    super.debug(message, ...optional);
    this.write('debug', message, optional);
  }

  override verbose(message: unknown, ...optional: unknown[]): void {
    super.verbose(message, ...optional);
    this.write('debug', message, optional);
  }

  private write(level: string, message: unknown, optional: unknown[]): void {
    if (!this.files) return;
    // Nest passes the context (the class name) as the last argument; an error also passes its stack before it.
    const context = typeof optional[optional.length - 1] === 'string' ? (optional[optional.length - 1] as string) : undefined;
    const stack = level === 'error' && typeof optional[0] === 'string' && optional.length > 1 ? (optional[0] as string) : undefined;
    this.files.log(level, typeof message === 'string' ? message : JSON.stringify(message), { context, stack, correlationId: currentCorrelationId() });
  }
}
