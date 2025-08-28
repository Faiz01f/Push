# DiziPush - Self-Hosted Web Push Notification Platform

![DiziPush Logo](https://img.shields.io/badge/DiziPush-Production%20Ready-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-blue)

A **modern, self-hosted web push notification platform** with beautiful dashboard, advanced segmentation, scheduling, real-time delivery, WordPress integration, and comprehensive analytics.

## ✨ Features

- 🚀 **Multi-tenant Projects** - Manage multiple projects and domains
- 🎯 **Advanced Segmentation** - Geo, device, behavior-based targeting
- 📊 **Real-time Analytics** - Delivery rates, CTR, A/B testing
- ⏰ **Smart Scheduling** - Instant, scheduled, recurring campaigns
- 🔌 **WordPress Plugin** - Auto-push on publish
- 📱 **Modern SDK** - Lightweight client with service worker
- 🔐 **Enterprise Security** - VAPID, JWT, audit logs
- 📈 **High Performance** - 10k+ notifications/min
- 🌐 **Self-Hosted** - Full data ownership
- 🎨 **Beautiful UI** - React + Tailwind + shadcn/ui

## 🚀 Quick Start

```bash
# Clone and start
git clone <repo-url> dizipush
cd dizipush
cp .env.example .env
make up

# Access dashboard
open http://localhost:3000
```

## 📁 Repository Structure

```
├── app/
│   ├── frontend/          # React + TypeScript + Tailwind
│   ├── backend/           # Node.js + Fastify + Prisma
│   ├── worker/            # Queue workers for delivery
│   └── wp-plugin/         # WordPress integration
├── infra/                 # Docker, NGINX, Terraform
├── scripts/               # Database, seeders, CLI tools
└── docs/                  # Complete documentation
```

## 🔧 Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Fastify, Prisma, PostgreSQL, Redis
- **Queue:** BullMQ for high-throughput delivery
- **Push:** Web Push API with VAPID authentication
- **Deployment:** Docker Compose, NGINX, Let's Encrypt ready
- **Monitoring:** Prometheus, Grafana, OpenTelemetry

## 📖 Documentation

- [Installation Guide](./docs/installation.md)
- [Quick Start Tutorial](./docs/quickstart.md)
- [API Reference](./docs/api.md)
- [SDK Documentation](./docs/sdk.md)
- [WordPress Plugin](./docs/wordpress.md)
- [Architecture Overview](./docs/architecture.md)

## 🛡️ Security & Compliance

- HTTPS-only with HSTS
- VAPID key management
- JWT authentication
- CSRF & CORS protection
- GDPR compliance hooks
- Comprehensive audit logging

## 📊 Performance

- **Throughput:** 10,000+ notifications/minute
- **Latency:** Sub-second delivery
- **Reliability:** Auto-retry with exponential backoff
- **Scalability:** Horizontal worker scaling

## 📄 License

MIT License - see [LICENSE](./LICENSE) file.

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

**Built with ❤️ for developers who value privacy and control.**