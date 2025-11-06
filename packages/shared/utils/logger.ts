/**
 * Structured Logger for Karmyq Platform
 *
 * Provides consistent logging across all services with:
 * - Structured JSON output for log aggregation
 * - Multiple log levels (debug, info, warn, error)
 * - Request correlation IDs
 * - Performance timing
 * - Context-aware logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  requestId?: string;
  service?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
}

class Logger {
  private serviceName: string;
  private minLevel: LogLevel;
  private isDevelopment: boolean;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minLevelIndex = levels.indexOf(this.minLevel);
    const currentLevelIndex = levels.indexOf(level);
    return currentLevelIndex >= minLevelIndex;
  }

  /**
   * Format log entry
   */
  private formatLog(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Human-readable format for development
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      const emoji = this.getLevelEmoji(entry.level);
      let output = `${emoji} [${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;

      if (entry.context && Object.keys(entry.context).length > 0) {
        output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
        if (entry.error.stack) {
          output += `\n${entry.error.stack}`;
        }
      }

      if (entry.duration !== undefined) {
        output += `\n  Duration: ${entry.duration}ms`;
      }

      return output;
    } else {
      // JSON format for production (log aggregation)
      return JSON.stringify(entry);
    }
  }

  /**
   * Get emoji for log level (development only)
   */
  private getLevelEmoji(level: LogLevel): string {
    const emojis: Record<LogLevel, string> = {
      debug: '🔍',
      info: '📝',
      warn: '⚠️',
      error: '❌',
    };
    return emojis[level] || '📝';
  }

  /**
   * Core logging function
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    duration?: number
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      context,
      duration,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    }

    const formatted = this.formatLog(entry);

    switch (level) {
      case 'debug':
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * Log HTTP request
   */
  request(
    method: string,
    path: string,
    statusCode?: number,
    context?: LogContext
  ): void {
    const message = `${method} ${path}${statusCode ? ` - ${statusCode}` : ''}`;
    this.info(message, { ...context, method, path, statusCode });
  }

  /**
   * Log database query
   */
  query(sql: string, duration?: number, context?: LogContext): void {
    const truncatedSql = sql.length > 100 ? sql.substring(0, 100) + '...' : sql;
    this.debug(`DB Query: ${truncatedSql}`, { ...context, sql: truncatedSql });
    if (duration !== undefined) {
      this.log('debug', `Query completed in ${duration}ms`, context, undefined, duration);
    }
  }

  /**
   * Log event publication
   */
  event(eventType: string, data: any, context?: LogContext): void {
    this.info(`Event published: ${eventType}`, {
      ...context,
      eventType,
      data: this.isDevelopment ? data : '[redacted]',
    });
  }

  /**
   * Create a timer for measuring performance
   */
  timer(label: string, context?: LogContext): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.log('info', `${label} completed`, context, undefined, duration);
    };
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(this.serviceName);
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (
      level: LogLevel,
      message: string,
      context?: LogContext,
      error?: Error,
      duration?: number
    ) => {
      originalLog(level, message, { ...additionalContext, ...context }, error, duration);
    };

    return childLogger;
  }
}

/**
 * Create a logger instance for a service
 */
export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware(logger: Logger) {
  return (req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const start = Date.now();

    // Add request ID to request object
    req.requestId = requestId;

    // Create request-specific logger
    req.logger = logger.child({
      requestId,
      userId: req.user?.id,
    });

    // Log incoming request
    req.logger.debug(`${req.method} ${req.path} started`, {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

      req.logger.log(
        level,
        `${req.method} ${req.path} ${res.statusCode}`,
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          ip: req.ip,
        },
        undefined,
        duration
      );
    });

    next();
  };
}

export default Logger;
