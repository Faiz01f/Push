/**
 * Logging utilities using Pino
 */

import pino from 'pino'
import { config } from '@/config'

// Create logger instance
export const logger = pino({
  level: config.LOG_LEVEL,
  
  // Pretty print in development
  ...(config.NODE_ENV === 'development' && config.LOG_FORMAT === 'pretty' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'HH:MM:ss.l',
        messageFormat: '{levelLabel} - {msg}',
      },
    },
  }),

  // Structured logging in production
  ...(config.NODE_ENV === 'production' && {
    formatters: {
      level: (label) => {
        return { level: label }
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),

  // Base fields
  base: {
    service: 'dizipush-backend',
    version: process.env.npm_package_version || '1.0.0',
  },

  // Redact sensitive data
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      'auth',
      'secret',
      'key',
      'vapidPrivateKey',
      'privateKey',
    ],
    censor: '[REDACTED]',
  },
})

// Child loggers for different modules
export const loggers = {
  http: logger.child({ module: 'http' }),
  db: logger.child({ module: 'database' }),
  auth: logger.child({ module: 'auth' }),
  push: logger.child({ module: 'push' }),
  queue: logger.child({ module: 'queue' }),
  webhook: logger.child({ module: 'webhook' }),
  cache: logger.child({ module: 'cache' }),
}

// Utility functions for common logging patterns
export const logUtils = {
  /**
   * Log API request
   */
  request: (method: string, path: string, statusCode: number, duration: number, userId?: string) => {
    loggers.http.info({
      method,
      path,
      statusCode,
      duration,
      userId,
    }, `${method} ${path} ${statusCode} ${duration}ms`)
  },

  /**
   * Log authentication events
   */
  auth: (event: string, userId: string, ip?: string, userAgent?: string) => {
    loggers.auth.info({
      event,
      userId,
      ip,
      userAgent,
    }, `Auth event: ${event}`)
  },

  /**
   * Log push notification events
   */
  push: (event: string, campaignId: string, subscriberCount?: number, error?: Error) => {
    if (error) {
      loggers.push.error({
        event,
        campaignId,
        subscriberCount,
        error: error.message,
        stack: error.stack,
      }, `Push event failed: ${event}`)
    } else {
      loggers.push.info({
        event,
        campaignId,
        subscriberCount,
      }, `Push event: ${event}`)
    }
  },

  /**
   * Log database operations
   */
  db: (operation: string, table: string, duration?: number, error?: Error) => {
    if (error) {
      loggers.db.error({
        operation,
        table,
        duration,
        error: error.message,
      }, `DB operation failed: ${operation} on ${table}`)
    } else {
      loggers.db.debug({
        operation,
        table,
        duration,
      }, `DB operation: ${operation} on ${table}`)
    }
  },

  /**
   * Log queue operations
   */
  queue: (job: string, queue: string, status: string, duration?: number, error?: Error) => {
    if (error) {
      loggers.queue.error({
        job,
        queue,
        status,
        duration,
        error: error.message,
      }, `Queue job failed: ${job} in ${queue}`)
    } else {
      loggers.queue.info({
        job,
        queue,
        status,
        duration,
      }, `Queue job ${status}: ${job}`)
    }
  },

  /**
   * Log webhook deliveries
   */
  webhook: (url: string, event: string, statusCode?: number, duration?: number, error?: Error) => {
    if (error) {
      loggers.webhook.error({
        url,
        event,
        statusCode,
        duration,
        error: error.message,
      }, `Webhook delivery failed: ${event} to ${url}`)
    } else {
      loggers.webhook.info({
        url,
        event,
        statusCode,
        duration,
      }, `Webhook delivered: ${event} to ${url}`)
    }
  },

  /**
   * Log security events
   */
  security: (event: string, ip?: string, userAgent?: string, details?: any) => {
    logger.warn({
      type: 'security',
      event,
      ip,
      userAgent,
      details,
    }, `Security event: ${event}`)
  },

  /**
   * Log performance metrics
   */
  performance: (metric: string, value: number, unit: string, tags?: Record<string, string>) => {
    logger.info({
      type: 'metric',
      metric,
      value,
      unit,
      tags,
    }, `Performance metric: ${metric} = ${value}${unit}`)
  },
}

// Error logging with context
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  }, `Error: ${error.message}`)
}

export default logger