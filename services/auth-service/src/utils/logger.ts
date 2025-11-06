import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

const { combine, timestamp, json, printf, colorize, errors } = winston.format

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, service, ...metadata }) => {
  let msg = `${timestamp} [${service}] ${level}: ${message}`

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`
  }

  return msg
})

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'auth-service',
    environment: process.env.NODE_ENV || 'development',
  },
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  transports: [
    // Console output (pretty format for development)
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
    }),

    // Rotating file for all logs
    new DailyRotateFile({
      filename: 'logs/auth-service-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(
        timestamp(),
        json()
      ),
    }),

    // Separate file for errors
    new DailyRotateFile({
      filename: 'logs/auth-service-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: combine(
        timestamp(),
        json()
      ),
    }),
  ],
})

// Stream for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.info(message.trim())
  },
}

export default logger
