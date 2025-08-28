#!/bin/bash

# DiziPush Setup Script
# This script helps you set up DiziPush on your server

set -e

echo "🚀 DiziPush Setup Script"
echo "========================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "❌ Please don't run this script as root"
  exit 1
fi

# Check for required dependencies
echo "📋 Checking dependencies..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        echo "   Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "✅ Docker found"
echo "✅ Docker Compose found"

# Create environment file
if [ ! -f .env ]; then
    echo "📝 Creating environment configuration..."
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo "🔧 Please edit .env file with your configuration before proceeding"
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    
    # Update .env file with generated secrets
    if command -v sed &> /dev/null; then
        sed -i "s/JWT_SECRET=\".*\"/JWT_SECRET=\"$JWT_SECRET\"/" .env
        sed -i "s/JWT_REFRESH_SECRET=\".*\"/JWT_REFRESH_SECRET=\"$JWT_REFRESH_SECRET\"/" .env
        sed -i "s/ENCRYPTION_KEY=\".*\"/ENCRYPTION_KEY=\"$ENCRYPTION_KEY\"/" .env
        echo "✅ Generated secure random secrets"
    fi
else
    echo "✅ Found existing .env file"
fi

# Generate VAPID keys
echo "🔐 Generating VAPID keys for push notifications..."
if ! npm list -g web-push &> /dev/null; then
    echo "📦 Installing web-push CLI globally..."
    npm install -g web-push
fi

VAPID_OUTPUT=$(npx web-push generate-vapid-keys --json)
VAPID_PUBLIC=$(echo $VAPID_OUTPUT | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).publicKey)")
VAPID_PRIVATE=$(echo $VAPID_OUTPUT | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).privateKey)")

# Update .env with VAPID keys
if command -v sed &> /dev/null; then
    sed -i "s/VAPID_PUBLIC_KEY=\".*\"/VAPID_PUBLIC_KEY=\"$VAPID_PUBLIC\"/" .env
    sed -i "s/VAPID_PRIVATE_KEY=\".*\"/VAPID_PRIVATE_KEY=\"$VAPID_PRIVATE\"/" .env
    echo "✅ Generated and saved VAPID keys"
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration (database, email, etc.)"
echo "2. Run: make up"
echo "3. Visit http://localhost:3000 to access DiziPush"
echo ""
echo "For production deployment:"
echo "- Set APP_URL to your domain"
echo "- Configure SSL/TLS"
echo "- Set up proper database backups"
echo "- Configure SMTP for email notifications"
echo ""
echo "Need help? Check docs/installation.md"