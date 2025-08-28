/**
 * DiziPush Configuration
 * Centralized configuration management with environment variables
 */

import { z } from 'zod'

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8000),
  HOST: z.string().default('0.0.0.0'),
  API_URL: z.string().default('http://localhost:8000'),
  
  // Database
  DATABASE_URL: z.string().min(1),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Encryption
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex
  
  // VAPID Keys
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().email(),
  
  // Email/SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  
  // Storage
  STORAGE_PATH: z.string().default('/app/storage'),
  S3_ENABLED: z.coerce.boolean().default(false),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: z.coerce.number().default(15), // minutes
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  API_RATE_LIMIT_WINDOW: z.coerce.number().default(60), // seconds
  API_RATE_LIMIT_MAX: z.coerce.number().default(1000),
  
  // Push Delivery
  PUSH_BATCH_SIZE: z.coerce.number().default(1000),
  PUSH_CONCURRENT_BATCHES: z.coerce.number().default(5),
  PUSH_RETRY_ATTEMPTS: z.coerce.number().default(3),
  PUSH_RETRY_DELAY: z.coerce.number().default(5000),
  
  // Features
  DEMO_MODE: z.coerce.boolean().default(false),
  DEBUG_PUSH: z.coerce.boolean().default(false),
  
  // Security
  FORCE_HTTPS: z.coerce.boolean().default(false),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  
  // Backup & Maintenance
  BACKUP_ENABLED: z.coerce.boolean().default(true),
  BACKUP_SCHEDULE: z.string().default('0 2 * * *'),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),
  
  // Webhooks
  WEBHOOK_TIMEOUT: z.coerce.number().default(30000),
  WEBHOOK_RETRY_ATTEMPTS: z.coerce.number().default(3),
})

// Parse and validate environment variables
const parseConfig = () => {
  try {
    return configSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid configuration:')
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`)
      })
    }
    process.exit(1)
  }
}

export const config = parseConfig()

// Feature flags based on configuration
export const features = {
  demoMode: config.DEMO_MODE,
  debugPush: config.DEBUG_PUSH,
  s3Storage: config.S3_ENABLED,
  backupEnabled: config.BACKUP_ENABLED,
  smtpEnabled: !!(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS),
}

// Plan limits configuration
export const planLimits = {
  STARTER: {
    domains: 2,
    subscribers: 1000,
    campaigns: 10,
    apiCalls: 1000,
    features: ['basic_analytics', 'scheduling']
  },
  GROWTH: {
    domains: 10,
    subscribers: 10000,
    campaigns: 100,
    apiCalls: 10000,
    features: ['basic_analytics', 'scheduling', 'advanced_analytics', 'import_export']
  },
  SUPERIOR: {
    domains: -1, // unlimited
    subscribers: 100000,
    campaigns: -1, // unlimited
    apiCalls: 100000,
    features: ['basic_analytics', 'scheduling', 'advanced_analytics', 'import_export', 'api_access', 'wp_plugin', 'auto_backups', 'advanced_segmentation']
  },
  ENTERPRISE: {
    domains: -1,
    subscribers: -1,
    campaigns: -1,
    apiCalls: -1,
    features: ['*'] // all features
  }
}

// Database connection options
export const dbConfig = {
  url: config.DATABASE_URL,
  log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
}

// Redis connection options
export const redisConfig = {
  url: config.REDIS_URL,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
}

// VAPID configuration
export const vapidConfig = {
  publicKey: config.VAPID_PUBLIC_KEY,
  privateKey: config.VAPID_PRIVATE_KEY,
  subject: config.VAPID_SUBJECT,
}

export default config