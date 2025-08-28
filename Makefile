# DiziPush - Self-Hosted Push Platform
.PHONY: help up down logs build test clean install migrate seed

# Default environment
ENV ?= dev

help: ## Show this help message
	@echo "DiziPush Development Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Start all services in development mode
	@echo "🚀 Starting DiziPush platform..."
	@if [ ! -f .env ]; then cp .env.example .env; echo "⚠️  Created .env from template. Please review settings."; fi
	@docker-compose -f docker-compose.$(ENV).yml up -d --build
	@echo "✅ DiziPush is running at http://localhost:3000"
	@echo "📊 Admin dashboard: http://localhost:3000/admin"
	@echo "📖 API docs: http://localhost:8000/docs"

down: ## Stop all services
	@echo "🛑 Stopping DiziPush platform..."
	@docker-compose -f docker-compose.$(ENV).yml down
	@echo "✅ All services stopped"

logs: ## Show logs for all services
	@docker-compose -f docker-compose.$(ENV).yml logs -f

build: ## Build all services
	@echo "🔨 Building DiziPush services..."
	@docker-compose -f docker-compose.$(ENV).yml build

test: ## Run all tests
	@echo "🧪 Running tests..."
	@npm run test

install: ## Install all dependencies
	@echo "📦 Installing dependencies..."
	@npm install

migrate: ## Run database migrations
	@echo "🗄️  Running database migrations..."
	@docker-compose -f docker-compose.$(ENV).yml exec backend npm run db:migrate

seed: ## Seed database with demo data
	@echo "🌱 Seeding database with demo data..."
	@docker-compose -f docker-compose.$(ENV).yml exec backend npm run db:seed

clean: ## Clean up containers, volumes, and images
	@echo "🧹 Cleaning up..."
	@docker-compose -f docker-compose.$(ENV).yml down -v --remove-orphans
	@docker system prune -f
	@echo "✅ Cleanup complete"

dev-setup: ## Complete development setup
	@echo "🔧 Setting up DiziPush development environment..."
	@make install
	@make up
	@sleep 10
	@make migrate
	@make seed
	@echo "✅ Development setup complete!"
	@echo "🌐 Visit http://localhost:3000 to get started"

prod-deploy: ## Deploy to production (requires proper .env.prod)
	@echo "🚀 Deploying to production..."
	@ENV=prod make up

backup: ## Create database backup
	@echo "💾 Creating database backup..."
	@docker-compose -f docker-compose.$(ENV).yml exec -T postgres pg_dump -U dizipush dizipush > backup-$(shell date +%Y%m%d-%H%M%S).sql
	@echo "✅ Backup created"

restore: ## Restore database from backup (BACKUP_FILE=backup.sql make restore)
	@if [ -z "$(BACKUP_FILE)" ]; then echo "❌ Please specify BACKUP_FILE=path/to/backup.sql"; exit 1; fi
	@echo "🔄 Restoring database from $(BACKUP_FILE)..."
	@docker-compose -f docker-compose.$(ENV).yml exec -T postgres psql -U dizipush -d dizipush < $(BACKUP_FILE)
	@echo "✅ Database restored"