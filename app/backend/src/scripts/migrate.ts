#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { logger } from '@/utils/logger'

async function migrate() {
  try {
    logger.info('🔄 Running database migrations...')
    
    // Run Prisma migrations
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    logger.info('✅ Database migrations completed')
  } catch (error) {
    logger.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  migrate()
}

export { migrate }