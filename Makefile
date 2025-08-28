# DiziPush - Self-Hosted Push Platform
# AppJet optimized commands

.PHONY: help build test clean install migrate seed generate-vapid dev

help: ## Show this help message
	@echo "DiziPush Commands for AppJet:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\\033[36m%-20s\\033[0m %s\\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "📦 Installing dependencies..."
	@cd app/frontend && npm install
	@cd app/backend && npm install
	@cd app/worker && npm install
	@echo "✅ All dependencies installed"

build: ## Build all services for production
	@echo "🔨 Building DiziPush services..."
	@cd app/frontend && npm run build
	@cd app/backend && npm run build
	@cd app/worker && npm run build
	@echo "✅ Build completed"

generate-vapid: ## Generate VAPID keys for push notifications
	@echo "🔐 Generating VAPID keys..."
	@node scripts/generate-vapid.js

migrate: ## Run database migrations
	@echo "🗄️ Running database migrations..."
	@cd app/backend && npm run db:migrate

seed: ## Seed database with demo data
	@echo "🌱 Seeding database..."
	@cd app/backend && npm run db:seed

test: ## Run all tests
	@echo "🧪 Running tests..."
	@cd app/frontend && npm test
	@cd app/backend && npm test
	@cd app/worker && npm test

clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf app/frontend/dist
	@rm -rf app/backend/dist
	@rm -rf app/worker/dist
	@rm -rf app/*/node_modules
	@echo "✅ Clean completed"

dev: ## Start development servers
	@echo "🚀 Starting DiziPush development..."
	@echo "Frontend will be available at http://localhost:3000"
	@echo "Backend API at http://localhost:8000"
	@echo "Run 'make migrate' and 'make seed' first if needed"

setup: ## Complete setup for AppJet deployment
	@echo "🚀 Setting up DiziPush for AppJet deployment..."
	@make install
	@make generate-vapid
	@echo "✅ Setup completed! Ready to deploy on AppJet"
	@echo ""
	@echo "Next steps:"
	@echo "1. Click Deploy Code button in AppJet"
	@echo "2. Wait for build to complete"
	@echo "3. Access your app URL"
	@echo "4. Complete the setup wizard"

default: help