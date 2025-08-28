import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '@/utils/database'
import { config } from '@/config/index'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6)
})

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body)
      
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          memberships: {
            include: { org: true }
          }
        }
      })

      if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        return reply.code(401).send({ error: 'Invalid credentials' })
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      )

      const refreshToken = jwt.sign(
        { userId: user.id },
        config.JWT_REFRESH_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
      )

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgs: user.memberships.map(m => ({
            id: m.orgId,
            name: m.org.name,
            role: m.role
          }))
        },
        accessToken,
        refreshToken
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(400).send({ error: 'Invalid input' })
    }
  })

  // Register
  fastify.post('/register', async (request, reply) => {
    try {
      const { email, name, password } = registerSchema.parse(request.body)
      
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        return reply.code(409).send({ error: 'Email already registered' })
      }

      const passwordHash = await bcrypt.hash(password, 12)
      
      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          emailVerified: true // For demo purposes
        }
      })

      // Create default org
      const org = await prisma.org.create({
        data: {
          name: `${name}'s Organization`,
          slug: `${name.toLowerCase().replace(/\s+/g, '-')}-org-${Date.now()}`
        }
      })

      // Create membership
      await prisma.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: 'OWNER'
        }
      })

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      )

      const refreshToken = jwt.sign(
        { userId: user.id },
        config.JWT_REFRESH_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
      )

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgs: [{
            id: org.id,
            name: org.name,
            role: 'OWNER'
          }]
        },
        accessToken,
        refreshToken
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(400).send({ error: 'Invalid input' })
    }
  })

  // Refresh token
  fastify.post('/refresh', async (request, reply) => {
    try {
      const { refreshToken } = z.object({
        refreshToken: z.string()
      }).parse(request.body)

      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as { userId: string }
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          memberships: {
            include: { org: true }
          }
        }
      })

      if (!user) {
        return reply.code(401).send({ error: 'Invalid token' })
      }

      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      )

      return {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgs: user.memberships.map(m => ({
            id: m.orgId,
            name: m.org.name,
            role: m.role
          }))
        }
      }
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' })
    }
  })

  // Get current user
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: (request as any).user.userId },
      include: {
        memberships: {
          include: { org: true }
        }
      }
    })

    return {
      id: user!.id,
      email: user!.email,
      name: user!.name,
      role: user!.role,
      orgs: user!.memberships.map(m => ({
        id: m.orgId,
        name: m.org.name,
        role: m.role
      }))
    }
  })
}