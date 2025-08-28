/**
 * Redis client and utilities for caching and queues
 */

import Redis from 'ioredis'
import { config } from '@/config'
import { logger } from '@/utils/logger'

// Redis connection options
const redisOptions = {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
}

// Main Redis client
export const redis = new Redis(config.REDIS_URL, {
  ...redisOptions,
  keyPrefix: 'dizipush:',
})

// Separate Redis client for Bull queues (to avoid key prefix issues)
export const queueRedis = new Redis(config.REDIS_URL, redisOptions)

// Redis event handlers
redis.on('connect', () => {
  logger.info('Redis connected successfully')
})

redis.on('error', (error) => {
  logger.error('Redis connection error:', error)
})

redis.on('ready', () => {
  logger.info('Redis is ready to accept commands')
})

redis.on('reconnecting', (time) => {
  logger.warn(`Redis reconnecting in ${time}ms`)
})

// Cache utilities
export const cache = {
  /**
   * Get value from cache with JSON parsing
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error)
      return null
    }
  },

  /**
   * Set value in cache with JSON stringification and TTL
   */
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      await redis.setex(key, ttl, serialized)
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error)
    }
  },

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error)
    }
  },

  /**
   * Delete multiple keys with pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length === 0) return 0
      return await redis.del(...keys)
    } catch (error) {
      logger.error(`Cache delete pattern error for pattern ${pattern}:`, error)
      return 0
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await redis.exists(key)
      return exists === 1
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error)
      return false
    }
  },

  /**
   * Set if not exists with TTL
   */
  async setNX(key: string, value: any, ttl: number = 3600): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value)
      const result = await redis.setex(key, ttl, serialized)
      return result === 'OK'
    } catch (error) {
      logger.error(`Cache setNX error for key ${key}:`, error)
      return false
    }
  },

  /**
   * Increment counter with TTL
   */
  async increment(key: string, ttl: number = 3600): Promise<number> {
    try {
      const multi = redis.multi()
      multi.incr(key)
      multi.expire(key, ttl)
      const results = await multi.exec()
      return results?.[0]?.[1] as number || 0
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error)
      return 0
    }
  },

  /**
   * Add to set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await redis.sadd(key, ...members)
    } catch (error) {
      logger.error(`Cache sadd error for key ${key}:`, error)
      return 0
    }
  },

  /**
   * Get all members of set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await redis.smembers(key)
    } catch (error) {
      logger.error(`Cache smembers error for key ${key}:`, error)
      return []
    }
  },

  /**
   * Remove from set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await redis.srem(key, ...members)
    } catch (error) {
      logger.error(`Cache srem error for key ${key}:`, error)
      return 0
    }
  }
}

// Rate limiting utilities
export const rateLimit = {
  /**
   * Check and increment rate limit counter
   */
  async check(key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const windowStart = now - (window * 1000)
    
    try {
      const multi = redis.multi()
      multi.zremrangebyscore(key, 0, windowStart)
      multi.zcard(key)
      multi.zadd(key, now, now)
      multi.expire(key, window)
      
      const results = await multi.exec()
      const current = (results?.[1]?.[1] as number) || 0
      
      return {
        allowed: current < limit,
        remaining: Math.max(0, limit - current - 1),
        resetTime: now + (window * 1000)
      }
    } catch (error) {
      logger.error(`Rate limit check error for key ${key}:`, error)
      return { allowed: true, remaining: limit - 1, resetTime: now + (window * 1000) }
    }
  }
}

// Session utilities
export const session = {
  /**
   * Store user session
   */
  async set(sessionId: string, data: any, ttl: number = 86400): Promise<void> {
    await cache.set(`session:${sessionId}`, data, ttl)
  },

  /**
   * Get user session
   */
  async get<T = any>(sessionId: string): Promise<T | null> {
    return cache.get(`session:${sessionId}`)
  },

  /**
   * Delete user session
   */
  async destroy(sessionId: string): Promise<void> {
    await cache.del(`session:${sessionId}`)
  },

  /**
   * Extend session TTL
   */
  async extend(sessionId: string, ttl: number = 86400): Promise<void> {
    await redis.expire(`session:${sessionId}`, ttl)
  }
}

export default redis