/**
 * Authentication utilities for JWT tokens and password hashing
 */

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { config } from '@/config'
import { logger } from '@/utils/logger'

// JWT token types
export interface JwtPayload {
  userId: string
  email: string
  role: string
  type: 'access' | 'refresh'
}

export interface ApiKeyPayload {
  projectId: string
  keyId: string
  scopes: string[]
  type: 'api_key'
}

// Password utilities
export const password = {
  /**
   * Hash password using bcrypt
   */
  async hash(plainPassword: string): Promise<string> {
    const saltRounds = 12
    return bcrypt.hash(plainPassword, saltRounds)
  },

  /**
   * Verify password against hash
   */
  async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword)
  },

  /**
   * Generate secure random password
   */
  generate(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }
}

// JWT token utilities
export const token = {
  /**
   * Generate access token
   */
  generateAccess(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'access' },
      config.JWT_SECRET,
      { 
        expiresIn: config.JWT_EXPIRES_IN,
        issuer: 'dizipush',
        audience: 'dizipush-api'
      }
    )
  },

  /**
   * Generate refresh token
   */
  generateRefresh(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'refresh' },
      config.JWT_REFRESH_SECRET,
      { 
        expiresIn: config.JWT_REFRESH_EXPIRES_IN,
        issuer: 'dizipush',
        audience: 'dizipush-api'
      }
    )
  },

  /**
   * Verify access token
   */
  verifyAccess(token: string): JwtPayload {
    return jwt.verify(token, config.JWT_SECRET, {
      issuer: 'dizipush',
      audience: 'dizipush-api'
    }) as JwtPayload
  },

  /**
   * Verify refresh token
   */
  verifyRefresh(token: string): JwtPayload {
    return jwt.verify(token, config.JWT_REFRESH_SECRET, {
      issuer: 'dizipush',
      audience: 'dizipush-api'
    }) as JwtPayload
  },

  /**
   * Verify API key token
   */
  verifyApiKey(token: string): ApiKeyPayload {
    return jwt.verify(token, config.JWT_SECRET, {
      issuer: 'dizipush',
      audience: 'dizipush-api'
    }) as ApiKeyPayload
  },

  /**
   * Decode token without verification (for debugging)
   */
  decode(token: string): any {
    return jwt.decode(token)
  }
}

// API Key utilities
export const apiKey = {
  /**
   * Generate API key
   */
  generate(): string {
    const prefix = 'dzp_'
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let key = prefix
    
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return key
  },

  /**
   * Hash API key for storage
   */
  async hash(key: string): Promise<string> {
    return password.hash(key)
  },

  /**
   * Verify API key
   */
  async verify(key: string, hash: string): Promise<boolean> {
    return password.verify(key, hash)
  },

  /**
   * Generate JWT token for API key
   */
  generateToken(payload: Omit<ApiKeyPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'api_key' },
      config.JWT_SECRET,
      { 
        issuer: 'dizipush',
        audience: 'dizipush-api'
      }
    )
  }
}

// Session utilities
export const session = {
  /**
   * Generate session ID
   */
  generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  },

  /**
   * Create session data
   */
  create(user: any): any {
    return {
      id: session.generateId(),
      userId: user.id,
      email: user.email,
      role: user.role,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    }
  }
}

// Security utilities
export const security = {
  /**
   * Generate CSRF token
   */
  generateCSRF(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  },

  /**
   * Generate secure random string
   */
  generateRandom(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    
    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  },

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Sanitize string input
   */
  sanitize(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .trim()
  }
}

// Rate limiting helpers
export const rateLimiting = {
  /**
   * Get rate limit key for user
   */
  getUserKey(userId: string, endpoint: string): string {
    return `rate_limit:user:${userId}:${endpoint}`
  },

  /**
   * Get rate limit key for IP
   */
  getIPKey(ip: string, endpoint: string): string {
    return `rate_limit:ip:${ip}:${endpoint}`
  },

  /**
   * Get rate limit key for API key
   */
  getApiKeyKey(keyId: string, endpoint: string): string {
    return `rate_limit:api_key:${keyId}:${endpoint}`
  }
}

export default {
  password,
  token,
  apiKey,
  session,
  security,
  rateLimiting
}