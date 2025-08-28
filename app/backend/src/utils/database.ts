/**
 * Database utilities and Prisma client setup
 */

import { PrismaClient } from '@prisma/client'
import { config } from '@/config'

// Extend PrismaClient with custom methods if needed
const createPrismaClient = () => {
  return new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'colorless',
  })
}

// Global Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined
}

// Use singleton pattern to avoid multiple connections in development
export const prisma = globalThis.__prisma || createPrismaClient()

if (config.NODE_ENV === 'development') {
  globalThis.__prisma = prisma
}

// Database utility functions
export const dbUtils = {
  /**
   * Test database connection
   */
  async testConnection() {
    try {
      await prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database connection failed:', error)
      return false
    }
  },

  /**
   * Close database connection
   */
  async disconnect() {
    await prisma.$disconnect()
  },

  /**
   * Execute raw query safely
   */
  async rawQuery<T = any>(query: string, params: any[] = []): Promise<T> {
    return prisma.$queryRawUnsafe(query, ...params)
  },

  /**
   * Begin transaction
   */
  async transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn)
  },

  /**
   * Get database statistics
   */
  async getStats() {
    const stats = await prisma.$queryRaw<Array<{ table: string; count: bigint }>>`
      SELECT 
        schemaname,
        tablename as table,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as count
      FROM pg_stat_user_tables 
      ORDER BY n_live_tup DESC;
    `
    
    return stats.map(stat => ({
      ...stat,
      count: Number(stat.count)
    }))
  }
}

export default prisma