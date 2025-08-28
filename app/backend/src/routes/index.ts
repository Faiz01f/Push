import { FastifyInstance } from 'fastify'
import { authRoutes } from './auth.js'
import { projectRoutes } from './projects.js'

export async function registerRoutes(fastify: FastifyInstance) {
  // API prefix for all routes
  await fastify.register(async function(fastify) {
    // Authentication routes
    await fastify.register(authRoutes, { prefix: '/auth' })
    
    // Project routes
    await fastify.register(projectRoutes, { prefix: '/projects' })
    
    // API info endpoint
    fastify.get('/', async () => {
      return {
        name: 'DiziPush API',
        version: '1.0.0',
        description: 'Self-hosted web push notification platform',
        documentation: '/docs',
        endpoints: {
          auth: '/api/auth',
          projects: '/api/projects',
          health: '/health'
        }
      }
    })
  }, { prefix: '/api' })
}