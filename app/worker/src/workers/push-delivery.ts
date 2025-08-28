/**
 * Push Delivery Worker
 * Handles the actual delivery of push notifications to subscribers
 */

import { Job } from 'bullmq'
import webpush from 'web-push'
import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'
import { config } from '../config'
import { z } from 'zod'

// Initialize Prisma client
const prisma = new PrismaClient()

// Initialize web-push
webpush.setVapidDetails(
  config.VAPID_SUBJECT,
  config.VAPID_PUBLIC_KEY,
  config.VAPID_PRIVATE_KEY
)

// Job data schema
const pushDeliveryJobSchema = z.object({
  campaignId: z.string(),
  subscriberIds: z.array(z.string()),
  payload: z.object({
    title: z.string(),
    body: z.string(),
    icon: z.string().optional(),
    image: z.string().optional(),
    badge: z.string().optional(),
    url: z.string().optional(),
    actions: z.array(z.object({
      action: z.string(),
      title: z.string(),
      icon: z.string().optional()
    })).optional(),
    tag: z.string().optional(),
    requireInteraction: z.boolean().optional(),
    silent: z.boolean().optional(),
    timestamp: z.number().optional(),
    data: z.record(z.any()).optional()
  }),
  options: z.object({
    TTL: z.number().optional(),
    urgency: z.enum(['very-low', 'low', 'normal', 'high']).optional(),
    topic: z.string().optional()
  }).optional()
})

type PushDeliveryJobData = z.infer<typeof pushDeliveryJobSchema>

// Send result interface
interface SendResult {
  subscriberId: string
  success: boolean
  statusCode?: number
  error?: string
  unsubscribe?: boolean
  retry?: boolean
}

export class PushDeliveryWorker {
  /**
   * Process push delivery job
   */
  static async process(job: Job<PushDeliveryJobData>) {
    const { campaignId, subscriberIds, payload, options = {} } = job.data

    logger.info({
      jobId: job.id,
      campaignId,
      subscriberCount: subscriberIds.length
    }, 'Processing push delivery job')

    try {
      // Validate job data
      pushDeliveryJobSchema.parse(job.data)

      // Get campaign and subscribers from database
      const [campaign, subscribers] = await Promise.all([
        prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { project: true }
        }),
        prisma.subscriber.findMany({
          where: {
            id: { in: subscriberIds },
            status: 'ACTIVE'
          }
        })
      ])

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`)
      }

      logger.info({
        campaignId,
        activeSubscribers: subscribers.length,
        requestedSubscribers: subscriberIds.length
      }, 'Found active subscribers for delivery')

      // Prepare notification payload
      const notificationPayload = {
        ...payload,
        timestamp: payload.timestamp || Date.now(),
        data: {
          campaignId,
          projectId: campaign.projectId,
          url: payload.url,
          ...payload.data
        }
      }

      // Send notifications in batches
      const results = await this.sendToSubscribers(
        subscribers,
        notificationPayload,
        options
      )

      // Process results and update database
      await this.processResults(campaignId, results)

      logger.info({
        jobId: job.id,
        campaignId,
        totalSent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
        unsubscribed: results.filter(r => r.unsubscribe).length
      }, 'Push delivery job completed')

      // Update job progress
      await job.updateProgress({
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total: results.length
      })

    } catch (error) {
      logger.error({
        jobId: job.id,
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Push delivery job failed')

      throw error
    }
  }

  /**
   * Send notifications to multiple subscribers
   */
  private static async sendToSubscribers(
    subscribers: any[],
    payload: any,
    options: any
  ): Promise<SendResult[]> {
    const results: SendResult[] = []

    // Send notifications concurrently but with limited parallelism
    const concurrency = 50 // Adjust based on provider limits
    const chunks = this.chunkArray(subscribers, concurrency)

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(subscriber =>
        this.sendToSubscriber(subscriber, payload, options)
      )

      const chunkResults = await Promise.allSettled(chunkPromises)
      
      chunkResults.forEach((result, index) => {
        const subscriber = chunk[index]
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            subscriberId: subscriber.id,
            success: false,
            error: result.reason?.message || 'Unknown error',
            retry: true
          })
        }
      })

      // Add small delay between chunks to avoid overwhelming the service
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  /**
   * Send notification to a single subscriber
   */
  private static async sendToSubscriber(
    subscriber: any,
    payload: any,
    options: any
  ): Promise<SendResult> {
    try {
      const subscription = {
        endpoint: subscriber.endpoint,
        keys: {
          p256dh: subscriber.p256dh,
          auth: subscriber.auth
        }
      }

      const pushOptions = {
        TTL: options.TTL || 86400, // 24 hours default
        urgency: options.urgency || 'normal',
        headers: {
          'Content-Encoding': 'aes128gcm'
        }
      }

      // Add topic header if provided (for collapsible notifications)
      if (options.topic) {
        pushOptions.headers['Topic'] = options.topic
      }

      const response = await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
        pushOptions
      )

      return {
        subscriberId: subscriber.id,
        success: true,
        statusCode: response.statusCode
      }

    } catch (error: any) {
      return this.handleSendError(subscriber.id, error)
    }
  }

  /**
   * Handle push send errors
   */
  private static handleSendError(subscriberId: string, error: any): SendResult {
    const statusCode = error.statusCode || error.status
    
    // Handle different error types
    switch (statusCode) {
      case 400:
        // Bad request - don't retry
        return {
          subscriberId,
          success: false,
          statusCode,
          error: 'Bad request',
          retry: false
        }

      case 401:
      case 403:
        // Unauthorized/Forbidden - authentication issue
        return {
          subscriberId,
          success: false,
          statusCode,
          error: 'Authentication failed',
          retry: false
        }

      case 404:
      case 410:
        // Not found/Gone - subscription is invalid, unsubscribe
        return {
          subscriberId,
          success: false,
          statusCode,
          error: 'Subscription invalid',
          retry: false,
          unsubscribe: true
        }

      case 413:
        // Payload too large
        return {
          subscriberId,
          success: false,
          statusCode,
          error: 'Payload too large',
          retry: false
        }

      case 429:
        // Rate limited - retry after delay
        return {
          subscriberId,
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
          subscriberId,
          success: false,
          statusCode,
          error: 'Server error',
          retry: true
        }

      default:
        // Unknown error - retry
        return {
          subscriberId,
          success: false,
          statusCode,
          error: error.message || 'Unknown error',
          retry: true
        }
    }
  }

  /**
   * Process send results and update database
   */
  private static async processResults(
    campaignId: string,
    results: SendResult[]
  ): Promise<void> {
    const now = new Date()
    
    // Prepare send attempts updates
    const sendAttempts = results.map(result => ({
      campaignId,
      subscriberId: result.subscriberId,
      status: result.success ? 'DELIVERED' : 'FAILED',
      errorCode: result.statusCode?.toString(),
      errorMessage: result.error,
      lastAttemptAt: now
    }))

    // Prepare events for successful sends
    const events = results
      .filter(result => result.success)
      .map(result => ({
        projectId: '', // Will be set by trigger
        subscriberId: result.subscriberId,
        campaignId,
        type: 'SEND',
        timestamp: now,
        metadata: {
          statusCode: result.statusCode
        }
      }))

    // Get subscribers to unsubscribe
    const unsubscribeIds = results
      .filter(result => result.unsubscribe)
      .map(result => result.subscriberId)

    try {
      await prisma.$transaction(async (tx) => {
        // Upsert send attempts
        for (const attempt of sendAttempts) {
          await tx.sendAttempt.upsert({
            where: {
              campaignId_subscriberId: {
                campaignId: attempt.campaignId,
                subscriberId: attempt.subscriberId
              }
            },
            create: attempt,
            update: {
              status: attempt.status,
              errorCode: attempt.errorCode,
              errorMessage: attempt.errorMessage,
              lastAttemptAt: attempt.lastAttemptAt,
              retries: { increment: 1 }
            }
          })
        }

        // Create events for successful sends
        if (events.length > 0) {
          // Get project ID from campaign
          const campaign = await tx.campaign.findUnique({
            where: { id: campaignId },
            select: { projectId: true }
          })

          if (campaign) {
            const eventsWithProjectId = events.map(event => ({
              ...event,
              projectId: campaign.projectId
            }))

            await tx.event.createMany({
              data: eventsWithProjectId
            })
          }
        }

        // Unsubscribe invalid subscriptions
        if (unsubscribeIds.length > 0) {
          await tx.subscriber.updateMany({
            where: { id: { in: unsubscribeIds } },
            data: {
              status: 'HARD_FAIL',
              unsubscribedAt: now
            }
          })

          // Create unsubscribe events
          const campaign = await tx.campaign.findUnique({
            where: { id: campaignId },
            select: { projectId: true }
          })

          if (campaign) {
            const unsubscribeEvents = unsubscribeIds.map(subscriberId => ({
              projectId: campaign.projectId,
              subscriberId,
              campaignId,
              type: 'UNSUBSCRIBE' as const,
              timestamp: now,
              metadata: { reason: 'invalid_subscription' }
            }))

            await tx.event.createMany({
              data: unsubscribeEvents
            })
          }
        }
      })

      logger.info({
        campaignId,
        successfulSends: results.filter(r => r.success).length,
        failedSends: results.filter(r => !r.success).length,
        unsubscribed: unsubscribeIds.length
      }, 'Database updates completed')

    } catch (error) {
      logger.error({
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update database with send results')
      throw error
    }
  }

  /**
   * Utility function to chunk array
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

export default PushDeliveryWorker