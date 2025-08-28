import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/database.js'
import webpush from 'web-push'

const createProjectSchema = z.object({
  name: z.string().min(1),
  orgId: z.string()
})

export async function projectRoutes(fastify: FastifyInstance) {
  // Get projects for user's orgs
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      include: {
        memberships: {
          include: {
            org: {
              include: {
                projects: {
                  include: {
                    domains: true,
                    _count: {
                      select: {
                        subscribers: true,
                        campaigns: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    const projects = user?.memberships.flatMap(m => 
      m.org.projects.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        plan: p.plan,
        orgId: p.orgId,
        orgName: m.org.name,
        domains: p.domains,
        subscriberCount: p._count.subscribers,
        campaignCount: p._count.campaigns,
        createdAt: p.createdAt
      }))
    ) || []

    return { projects }
  })

  // Get single project
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        org: {
          include: {
            memberships: {
              where: { userId: request.user.userId }
            }
          }
        },
        domains: true,
        _count: {
          select: {
            subscribers: true,
            campaigns: true
          }
        }
      }
    })

    if (!project || project.org.memberships.length === 0) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      plan: project.plan,
      settings: project.settings,
      domains: project.domains,
      subscriberCount: project._count.subscribers,
      campaignCount: project._count.campaigns,
      vapidPublicKey: project.vapidPublicKey,
      createdAt: project.createdAt
    }
  })

  // Create project
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { name, orgId } = createProjectSchema.parse(request.body)
    
    // Check if user has access to org
    const membership = await prisma.membership.findUnique({
      where: { 
        userId_orgId: { 
          userId: request.user.userId, 
          orgId 
        } 
      }
    })

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' })
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    
    // Generate VAPID keys for the project
    const vapidKeys = webpush.generateVAPIDKeys()
    
    const project = await prisma.project.create({
      data: {
        name,
        slug,
        orgId,
        vapidPublicKey: vapidKeys.publicKey,
        vapidPrivateKey: vapidKeys.privateKey
      },
      include: {
        domains: true,
        _count: {
          select: {
            subscribers: true,
            campaigns: true
          }
        }
      }
    })

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      plan: project.plan,
      domains: project.domains,
      subscriberCount: project._count.subscribers,
      campaignCount: project._count.campaigns,
      vapidPublicKey: project.vapidPublicKey
    }
  })

  // Update project
  fastify.put('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const { name, settings } = z.object({
      name: z.string().min(1).optional(),
      settings: z.record(z.any()).optional()
    }).parse(request.body)

    // Check permissions
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        org: {
          include: {
            memberships: {
              where: { userId: request.user.userId }
            }
          }
        }
      }
    })

    if (!project || project.org.memberships.length === 0) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    const membership = project.org.memberships[0]
    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' })
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(settings && { settings })
      }
    })

    return updated
  })

  // Delete project
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)

    // Check permissions
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        org: {
          include: {
            memberships: {
              where: { userId: request.user.userId }
            }
          }
        }
      }
    })

    if (!project || project.org.memberships.length === 0) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    const membership = project.org.memberships[0]
    if (membership.role !== 'OWNER') {
      return reply.code(403).send({ error: 'Only project owners can delete projects' })
    }

    await prisma.project.delete({ where: { id } })
    return { message: 'Project deleted successfully' }
  })
}