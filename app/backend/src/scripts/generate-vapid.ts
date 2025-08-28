#!/usr/bin/env tsx

import webpush from 'web-push'
import fs from 'fs'
import path from 'path'

function generateVapidKeys() {
  console.log('🔑 Generating VAPID keys...')
  
  const vapidKeys = webpush.generateVAPIDKeys()
  
  console.log('✅ VAPID keys generated successfully!')
  console.log('')
  console.log('Public Key:', vapidKeys.publicKey)
  console.log('Private Key:', vapidKeys.privateKey)
  console.log('')
  console.log('Add these to your .env file:')
  console.log(`VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`)
  console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`)
  console.log(`VAPID_SUBJECT="mailto:admin@yourdomain.com"`)
  
  // Write to .env.example if it doesn't exist
  const envExamplePath = path.join(process.cwd(), '.env.example')
  if (!fs.existsSync(envExamplePath)) {
    const envContent = `# Database
DATABASE_URL="postgresql://dizipush:password@localhost:5432/dizipush"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-jwt-secret-change-this"
JWT_REFRESH_SECRET="your-jwt-refresh-secret-change-this"

# VAPID Keys for Web Push
VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"
VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"
VAPID_SUBJECT="mailto:admin@yourdomain.com"

# Server
PORT=3001
NODE_ENV="development"

# Optional: Email (for notifications)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""

# Optional: File Storage
STORAGE_TYPE="local"
STORAGE_PATH="./storage"

# Optional: Backup Storage
BACKUP_STORAGE_TYPE="local"
BACKUP_STORAGE_PATH="./backups"
`
    
    fs.writeFileSync(envExamplePath, envContent)
    console.log('')
    console.log('📝 Created .env.example file with the keys')
  }
  
  return vapidKeys
}

if (require.main === module) {
  generateVapidKeys()
}

export { generateVapidKeys }