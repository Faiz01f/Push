/**
 * DiziPush Worker Service
 * Handles queue processing for push notifications, scheduling, and data processing
 */

import { Worker, Job } from 'bullmq'
import { logger } from './utils/logger'
import { redis } from './utils/redis'
import { config } from './config'
import { PushDeliveryWorker } from './workers/push-delivery'
import { CampaignSchedulerWorker } from './workers/campaign-scheduler'
import { DataProcessorWorker } from './workers/data-processor'
import { BackupWorker } from './workers/backup'
import { WebhookWorker } from './workers/webhook'
import { AnalyticsWorker } from './workers/analytics'

/**
 * Worker Service Manager
 */
class WorkerService {
  private workers: Worker[] = []
  private isShuttingDown = false

  async start() {
    logger.info('Starting DiziPush worker service...')

    try {
      // Initialize workers
      await this.initializeWorkers()

      // Start health monitoring
      this.startHealthMonitoring()

      logger.info({
        workers: this.workers.length,
        queues: this.workers.map(w => w.name)
      }, 'All workers started successfully')

    } catch (error) {
      logger.error('Failed to start worker service:', error)
      process.exit(1)
    }
  }

  /**
   * Initialize all worker processes
   */
  private async initializeWorkers() {
    const workerConfigs = [
      // Push delivery workers (multiple instances for high throughput)
      ...Array.from({ length: config.PUSH_CONCURRENT_BATCHES }, (_, i) => ({
        name: `push-delivery-${i + 1}`,
        queueName: 'push-delivery',
        processor: PushDeliveryWorker,
        concurrency: 10
      })),

      // Campaign scheduler
      {
        name: 'campaign-scheduler',
        queueName: 'campaign-scheduler',
        processor: CampaignSchedulerWorker,
        concurrency: 1
      },

      // Data processors
      {
        name: 'data-processor',
        queueName: 'data-processor',
        processor: DataProcessorWorker,
        concurrency: 5
      },

      // Backup worker
      {
        name: 'backup-worker',
        queueName: 'backup',
        processor: BackupWorker,
        concurrency: 1
      },

      // Webhook delivery
      {
        name: 'webhook-worker',
        queueName: 'webhooks',
        processor: WebhookWorker,
        concurrency: 3
      },

      // Analytics aggregation
      {
        name: 'analytics-worker',
        queueName: 'analytics',
        processor: AnalyticsWorker,
        concurrency: 2
      }
    ]

    for (const workerConfig of workerConfigs) {
      const worker = new Worker(
        workerConfig.queueName,
        async (job: Job) => {
          const startTime = Date.now()
          
          try {
            logger.info({
              worker: workerConfig.name,
              jobId: job.id,
              jobType: job.name,
              attempt: job.attemptsMade + 1
            }, 'Processing job')

            await workerConfig.processor.process(job)

            const duration = Date.now() - startTime
            logger.info({
              worker: workerConfig.name,
              jobId: job.id,
              duration
            }, 'Job completed successfully')

          } catch (error) {
            const duration = Date.now() - startTime
            logger.error({
              worker: workerConfig.name,
              jobId: job.id,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Job failed')
            
            throw error
          }
        },
        {
          connection: redis,
          concurrency: workerConfig.concurrency,
          maxStalledCount: 3,
          stalledInterval: 30000,
          retryProcessDelay: 5000,
          settings: {
            backoffStrategy: (attemptsMade: number) => {
              // Exponential backoff with jitter
              const delay = Math.min(1000 * Math.pow(2, attemptsMade), 30000)
              const jitter = Math.random() * 0.1 * delay
              return Math.floor(delay + jitter)
            }
          }
        }
      )

      // Worker event handlers
      worker.on('ready', () => {
        logger.info({ worker: workerConfig.name }, 'Worker ready')
      })

      worker.on('error', (error) => {
        logger.error({ worker: workerConfig.name, error }, 'Worker error')
      })

      worker.on('stalled', (jobId) => {
        logger.warn({ worker: workerConfig.name, jobId }, 'Job stalled')
      })

      worker.on('completed', (job) => {
        logger.debug({
          worker: workerConfig.name,
          jobId: job.id,
          duration: job.finishedOn! - job.processedOn!
        }, 'Job completed')
      })

      worker.on('failed', (job, error) => {
        logger.error({
          worker: workerConfig.name,
          jobId: job?.id,
          error: error.message,
          attempts: job?.attemptsMade
        }, 'Job failed')
      })

      this.workers.push(worker)
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring() {
    setInterval(async () => {
      try {
        await this.checkWorkerHealth()
      } catch (error) {
        logger.error('Health check failed:', error)
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Check health of all workers
   */
  private async checkWorkerHealth() {
    const healthStats = {
      totalWorkers: this.workers.length,
      healthyWorkers: 0,
      stalled: 0,
      errors: 0
    }

    for (const worker of this.workers) {
      try {
        if (worker.isRunning()) {
          healthStats.healthyWorkers++
        }
      } catch (error) {
        healthStats.errors++
        logger.warn({ worker: worker.name, error }, 'Worker health check failed')
      }
    }

    // Log health stats
    logger.debug(healthStats, 'Worker health check')

    // Alert if too many workers are unhealthy
    const healthPercentage = (healthStats.healthyWorkers / healthStats.totalWorkers) * 100
    if (healthPercentage < 80) {
      logger.error(healthStats, 'Worker health degraded')
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    logger.info('Shutting down worker service...')

    try {
      // Close all workers
      await Promise.all(
        this.workers.map(async (worker) => {
          try {
            await worker.close()
            logger.info({ worker: worker.name }, 'Worker closed')
          } catch (error) {
            logger.error({ worker: worker.name, error }, 'Error closing worker')
          }
        })
      )

      // Close Redis connection
      await redis.disconnect()

      logger.info('Worker service shutdown complete')
    } catch (error) {
      logger.error('Error during shutdown:', error)
      process.exit(1)
    }
  }
}

// Create worker service instance
const workerService = new WorkerService()

// Graceful shutdown handling
const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2']
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully...`)
    await workerService.shutdown()
    process.exit(0)
  })
})

// Unhandled error handling
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the service
if (require.main === module) {
  workerService.start().catch((error) => {
    logger.fatal('Failed to start worker service:', error)
    process.exit(1)
  })
}

export { workerService }
export default workerService