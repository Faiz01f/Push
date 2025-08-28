/**
 * DiziPush Backend Server
 * Main entry point for the push notification platform API
 */

import fastify from 'fastify'
import { config } from '@/config'
import { registerPlugins } from '@/plugins'
import { registerRoutes } from '@/routes'
import { logger } from '@/utils/logger'
import { prisma } from '@/utils/database'
import { redis } from '@/utils/redis'

/**
 * Build Fastify server instance with all plugins and routes
 */
async function buildServer() {
  const server = fastify({
    logger: logger,
    trustProxy: true,
    disableRequestLogging: config.NODE_ENV === 'production',
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  })

  // Register plugins (auth, cors, swagger, etc.)
  await registerPlugins(server)

  // Register all API routes
  await registerRoutes(server)

  // Health check endpoint
  server.get('/health', async (request, reply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`
      
      // Check Redis connection
      await redis.ping()

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: 'healthy',
          redis: 'healthy'
        }
      }
    } catch (error) {
      reply.status(503)
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Graceful shutdown handling
  const signals = ['SIGTERM', 'SIGINT']
  
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`)
      
      try {
        await server.close()
        await prisma.$disconnect()
        await redis.disconnect()
        logger.info('Server closed successfully')
        process.exit(0)
      } catch (error) {
        logger.error('Error during shutdown:', error)
        process.exit(1)
      }
    })
  })

  return server
}

/**
 * Start the server
 */
async function start() {
  try {
    const server = await buildServer()
    
    await server.listen({
      port: config.PORT,
      host: config.HOST
    })

    logger.info({
      port: config.PORT,
      host: config.HOST,
      environment: config.NODE_ENV
    }, 'DiziPush server started successfully')

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  start()
}

export { buildServer, start }