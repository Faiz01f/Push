#!/usr/bin/env node

/**
 * Generate VAPID Keys for DiziPush
 * 
 * This script generates a pair of VAPID keys (public and private) 
 * that are required for web push notifications.
 * 
 * Usage:
 *   node scripts/generate-vapid.js
 *   npm run generate-vapid-keys
 */

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

console.log('🔑 Generating VAPID keys for DiziPush...\n');

try {
  // Generate VAPID key pair
  const vapidKeys = webpush.generateVAPIDKeys();
  
  console.log('✅ VAPID keys generated successfully!\n');
  
  // Display the keys
  console.log('📋 Add these to your .env file:\n');
  console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
  console.log('VAPID_SUBJECT=mailto:admin@yourdomain.com');
  console.log('');
  
  // Optionally write to .env file
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (fs.existsSync(envPath)) {
    console.log('📝 Do you want to update your .env file? (y/n)');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('', (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        updateEnvFile(envPath, vapidKeys);
      }
      rl.close();
    });
  } else if (fs.existsSync(envExamplePath)) {
    console.log('ℹ️  No .env file found. Copy .env.example to .env and add the keys above.');
  }
  
} catch (error) {
  console.error('❌ Failed to generate VAPID keys:', error);
  process.exit(1);
}

/**
 * Update .env file with generated VAPID keys
 */
function updateEnvFile(envPath, vapidKeys) {
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update or add VAPID keys
    envContent = updateEnvVar(envContent, 'VAPID_PUBLIC_KEY', vapidKeys.publicKey);
    envContent = updateEnvVar(envContent, 'VAPID_PRIVATE_KEY', vapidKeys.privateKey);
    
    // Add VAPID_SUBJECT if it doesn't exist
    if (!envContent.includes('VAPID_SUBJECT=')) {
      envContent += '\nVAPID_SUBJECT=mailto:admin@yourdomain.com';
    }
    
    // Write back to file
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ .env file updated with new VAPID keys');
    console.log('⚠️  Don\'t forget to update VAPID_SUBJECT with your email address');
    
  } catch (error) {
    console.error('❌ Failed to update .env file:', error);
  }
}

/**
 * Update or add environment variable in content
 */
function updateEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  
  if (regex.test(content)) {
    // Update existing variable
    return content.replace(regex, `${key}=${value}`);
  } else {
    // Add new variable
    return content + `\n${key}=${value}`;
  }
}