/**
 * Web Push notification utilities using the web-push library
 */

import webpush from 'web-push'
import { config, vapidConfig } from '@/config'
import { logger, logUtils } from '@/utils/logger'
import { z } from 'zod'

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  vapidConfig.subject,
  vapidConfig.publicKey,
  vapidConfig.privateKey
)

// Push notification payload schema
export const pushPayloadSchema = z.object({
  title: z.string().max(100),
  body: z.string().max(300),
  icon: z.string().url().optional(),
  image: z.string().url().optional(),
  badge: z.string().url().optional(),
  url: z.string().url().optional(),
  actions: z.array(z.object({
    action: z.string(),
    title: z.string().max(50),
    icon: z.string().url().optional()
  })).max(2).optional(),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
  silent: z.boolean().optional(),
  timestamp: z.number().optional(),
  data: z.record(z.any()).optional(),
})

export type PushPayload = z.infer<typeof pushPayloadSchema>

// Subscription schema
export const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  })
})

export type PushSubscription = z.infer<typeof subscriptionSchema>

// Push options
export interface PushOptions {
  TTL?: number // Time to live in seconds
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
  topic?: string // For collapsible notifications
  headers?: Record<string, string>
}

// Send result interface
export interface SendResult {
  success: boolean
  statusCode?: number
  error?: string
  retry?: boolean
  unsubscribe?: boolean
}

// Push notification service
export class PushService {
  /**
   * Send push notification to a single subscription
   */
  async sendToSubscription(
    subscription: PushSubscription,
    payload: PushPayload,
    options: PushOptions = {}
  ): Promise<SendResult> {
    try {
      // Validate payload
      const validatedPayload = pushPayloadSchema.parse(payload)
      
      // Create notification data
      const notificationData = {
        ...validatedPayload,
        timestamp: validatedPayload.timestamp || Date.now(),
        data: {
          url: validatedPayload.url,
          ...validatedPayload.data
        }
      }

      // Push options with defaults
      const pushOptions = {
        TTL: options.TTL || 86400, // 24 hours default
        urgency: options.urgency || 'normal',
        headers: {
          'Content-Encoding': 'aes128gcm',
          ...options.headers
        }
      }

      // Add topic header if provided (for collapsible notifications)
      if (options.topic) {
        pushOptions.headers['Topic'] = options.topic
      }

      // Send the notification
      const response = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        },
        JSON.stringify(notificationData),
        pushOptions
      )

      logUtils.push('notification_sent', '', 1)
      
      return {
        success: true,
        statusCode: response.statusCode
      }

    } catch (error: any) {
      return this.handleSendError(error)
    }
  }

  /**
   * Send push notification to multiple subscriptions in batch
   */
  async sendBatch(
    subscriptions: PushSubscription[],
    payload: PushPayload,
    options: PushOptions = {}
  ): Promise<{ results: SendResult[]; stats: { sent: number; failed: number; unsubscribed: number } }> {
    const results: SendResult[] = []
    let sent = 0
    let failed = 0
    let unsubscribed = 0

    // Process in batches to avoid overwhelming the service
    const batchSize = config.PUSH_BATCH_SIZE
    const batches = this.chunkArray(subscriptions, batchSize)

    for (const batch of batches) {
      const batchPromises = batch.map(subscription => 
        this.sendToSubscription(subscription, payload, options)
      )

      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
          if (result.value.success) {
            sent++
          } else if (result.value.unsubscribe) {
            unsubscribed++
          } else {
            failed++
          }
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
            retry: true
          })
          failed++
        }
      })
    }

    const stats = { sent, failed, unsubscribed }
    logUtils.push('batch_sent', '', subscriptions.length)
    
    return { results, stats }
  }

  /**
   * Handle push send errors and determine retry/unsubscribe actions
   */
  private handleSendError(error: any): SendResult {
    const statusCode = error.statusCode || error.status
    const body = error.body || error.message

    logUtils.push('notification_error', '', 1, error)

    // Handle different error types
    switch (statusCode) {
      case 400:
        // Bad request - don't retry
        return {
          success: false,
          statusCode,
          error: 'Bad request',
          retry: false
        }

      case 401:
      case 403:
        // Unauthorized/Forbidden - authentication issue
        return {
          success: false,
          statusCode,
          error: 'Authentication failed',
          retry: false
        }

      case 404:
      case 410:
        // Not found/Gone - subscription is invalid, unsubscribe
        return {
          success: false,
          statusCode,
          error: 'Subscription invalid',
          retry: false,
          unsubscribe: true
        }

      case 413:
        // Payload too large
        return {
          success: false,
          statusCode,
          error: 'Payload too large',
          retry: false
        }

      case 429:
        // Rate limited - retry after delay
        return {
          success: false,
          statusCode,
          error: 'Rate limited',
          retry: true
        }

      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors - retry
        return {
          success: false,
          statusCode,
          error: 'Server error',
          retry: true
        }

      default:
        // Unknown error - retry
        return {
          success: false,
          statusCode,
          error: body || 'Unknown error',
          retry: true
        }
    }
  }

  /**
   * Validate a push subscription
   */
  async validateSubscription(subscription: PushSubscription): Promise<boolean> {
    try {
      subscriptionSchema.parse(subscription)
      
      // Send a test notification to validate
      const testPayload = {
        title: 'Test',
        body: 'Validation test',
        silent: true
      }

      const result = await this.sendToSubscription(subscription, testPayload, {
        TTL: 60 // 1 minute TTL for test
      })

      return result.success || result.statusCode === 201
    } catch (error) {
      logger.error('Subscription validation failed:', error)
      return false
    }
  }

  /**
   * Generate VAPID keys (for initial setup)
   */
  static generateVAPIDKeys() {
    return webpush.generateVAPIDKeys()
  }

  /**
   * Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

// Utility functions for creating common notification payloads
export const notificationTemplates = {
  /**
   * Welcome notification for new subscribers
   */
  welcome(projectName: string): PushPayload {
    return {
      title: `Welcome to ${projectName}!`,
      body: 'Thanks for subscribing to our notifications. Stay tuned for updates!',
      icon: '/icons/welcome.png',
      tag: 'welcome',
      requireInteraction: false
    }
  },

  /**
   * Blog post notification
   */
  blogPost(title: string, excerpt: string, url: string, image?: string): PushPayload {
    return {
      title: title,
      body: excerpt,
      url: url,
      image: image,
      icon: '/icons/blog.png',
      tag: 'blog-post',
      actions: [
        { action: 'read', title: 'Read Now' },
        { action: 'save', title: 'Save for Later' }
      ]
    }
  },

  /**
   * Marketing campaign notification
   */
  campaign(title: string, body: string, ctaUrl: string, image?: string): PushPayload {
    return {
      title: title,
      body: body,
      url: ctaUrl,
      image: image,
      icon: '/icons/campaign.png',
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'View Offer' },
        { action: 'dismiss', title: 'Not Interested' }
      ]
    }
  },

  /**
   * Breaking news notification
   */
  breaking(title: string, summary: string, newsUrl: string): PushPayload {
    return {
      title: `🚨 ${title}`,
      body: summary,
      url: newsUrl,
      icon: '/icons/breaking.png',
      badge: '/icons/news-badge.png',
      tag: 'breaking-news',
      requireInteraction: true,
      urgency: 'high' as const
    }
  },

  /**
   * Test notification
   */
  test(): PushPayload {
    return {
      title: 'Test Notification',
      body: 'This is a test notification from DiziPush.',
      icon: '/icons/test.png',
      tag: 'test',
      timestamp: Date.now(),
      data: {
        test: true
      }
    }
  }
}

// Export singleton instance
export const pushService = new PushService()

export default pushService