#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seed() {
  console.log('🌱 Seeding database...')

  // Create demo organization
  const org = await prisma.org.create({
    data: {
      name: 'Demo Organization',
      slug: 'demo-org'
    }
  })

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 12)
  const user = await prisma.user.create({
    data: {
      email: 'demo@dizipush.com',
      name: 'Demo User',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      emailVerified: true
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

  // Create demo project
  const project = await prisma.project.create({
    data: {
      name: 'Demo Project',
      slug: 'demo-project',
      orgId: org.id,
      plan: 'STARTER',
      settings: {}
    }
  })

  // Create demo domain
  await prisma.domain.create({
    data: {
      hostname: 'localhost:3000',
      projectId: project.id,
      verified: true
    }
  })

  // Create demo API key
  const apiKeyHash = await bcrypt.hash('demo-api-key', 12)
  await prisma.apiKey.create({
    data: {
      name: 'Demo API Key',
      keyHash: apiKeyHash,
      projectId: project.id,
      scopes: ['campaigns:send', 'subscribers:read', 'analytics:read'],
      lastUsedAt: new Date()
    }
  })

  console.log('✅ Database seeded successfully')
  console.log('Demo credentials:')
  console.log('  Email: demo@dizipush.com')
  console.log('  Password: demo123')
  console.log('  API Key: demo-api-key')
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })