import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { config } from '@/config'

export async function registerPlugins(fastify: FastifyInstance) {
  // CORS
  await fastify.register(cors, {
    origin: config.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://localhost:5173']
      : true,
    credentials: true
  })

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false
  })

  // JWT authentication
  await fastify.register(jwt, {
    secret: config.JWT_SECRET,
    sign: {
      algorithm: 'HS256',
      expiresIn: '15m'
    },
    verify: {
      algorithms: ['HS256']
    }
  })

  // File uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    }
  })

  // Rate limiting
  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute'
  })

  // API documentation
  if (config.NODE_ENV === 'development') {
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: 'DiziPush API',
          description: 'Self-hosted web push notification platform API',
          version: '1.0.0'
        },
        externalDocs: {
          url: 'https://github.com/dizipush/dizipush',
          description: 'Find more info here'
        },
        host: `localhost:${config.PORT}`,
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: 'Projects', description: 'Project management' },
          { name: 'Subscribers', description: 'Subscriber management' },
          { name: 'Campaigns', description: 'Campaign management' },
          { name: 'Analytics', description: 'Analytics and reporting' }
        ],
        securityDefinitions: {
          Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'JWT token'
          }
        }
      }
    })

    await fastify.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject) => {
        return swaggerObject
      },
      transformSpecificationClone: true
    })
  }

  // Authentication decorator
  fastify.decorate('authenticate', async function(request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })
}