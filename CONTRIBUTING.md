# Contributing to DiziPush

Thank you for your interest in contributing to DiziPush! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 14+
- Redis 7+
- Basic knowledge of TypeScript/JavaScript, React, and Node.js

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/dizipush.git
   cd dizipush
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development environment**
   ```bash
   make dev-setup
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## 📁 Project Structure

```
dizipush/
├── app/
│   ├── frontend/     # React frontend (Vite + TypeScript)
│   ├── backend/      # Node.js API server (Fastify + Prisma)
│   ├── worker/       # Queue workers (BullMQ)
│   └── wp-plugin/    # WordPress plugin (PHP)
├── infra/           # Infrastructure configs (NGINX, Docker, etc.)
├── scripts/         # Database scripts, utilities
├── docs/           # Documentation
└── public/         # Static assets, service worker
```

## 🔧 Development Guidelines

### Code Style

We use ESLint and Prettier for code formatting. Please ensure your code follows these standards:

```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### TypeScript

- Use strict TypeScript settings
- Define proper interfaces and types
- Avoid `any` types - use proper typing
- Use JSDoc comments for complex functions

### Database Changes

1. **Schema Changes**
   ```bash
   cd app/backend
   npm run db:migrate:dev
   ```

2. **Seed Data**
   ```bash
   npm run db:seed
   ```

3. **Reset Database**
   ```bash
   npm run db:reset
   ```

### Testing

Write tests for all new features:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### API Development

1. **Follow REST conventions**
   - Use proper HTTP methods (GET, POST, PUT, DELETE)
   - Use meaningful HTTP status codes
   - Include proper error handling

2. **Document API endpoints**
   - Add OpenAPI/Swagger documentation
   - Include request/response examples
   - Document error responses

3. **Rate limiting**
   - Implement appropriate rate limits
   - Test rate limiting functionality

### Frontend Development

1. **Component Structure**
   - Use functional components with hooks
   - Keep components small and focused
   - Use TypeScript interfaces for props

2. **State Management**
   - Use Zustand for global state
   - Use React Query for server state
   - Keep local state minimal

3. **Styling**
   - Use Tailwind CSS classes
   - Follow the design system
   - Ensure responsive design
   - Test dark/light mode

## 📝 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```
feat(api): add campaign scheduling endpoint
fix(frontend): resolve notification permission dialog
docs: update installation guide
refactor(worker): improve push delivery performance
test(api): add integration tests for segments
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment information**
   - Operating system
   - Node.js version
   - Browser version (for frontend issues)
   - DiziPush version

2. **Steps to reproduce**
   - Clear, step-by-step instructions
   - Expected behavior
   - Actual behavior

3. **Additional context**
   - Screenshots or videos
   - Error messages and stack traces
   - Relevant configuration

## ✨ Feature Requests

Before submitting a feature request:

1. **Check existing issues** to avoid duplicates
2. **Provide clear use cases** and motivation
3. **Consider implementation complexity**
4. **Be open to discussion** and feedback

## 🔄 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow coding guidelines
   - Add tests for new functionality
   - Update documentation

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

4. **Submit pull request**
   - Use descriptive title and description
   - Reference related issues
   - Include screenshots for UI changes
   - Ensure CI passes

5. **Code review process**
   - Address reviewer feedback
   - Keep discussions constructive
   - Be patient during review

## 📚 Documentation

Help improve our documentation:

- **API Documentation**: Update OpenAPI specs in `/docs/api.md`
- **User Guides**: Update guides in `/docs/`
- **Code Comments**: Add JSDoc comments for complex functions
- **README Updates**: Keep README current with new features

## 🔒 Security

If you discover security vulnerabilities:

1. **Do NOT open a public issue**
2. **Email security concerns** to security@dizipush.com
3. **Provide detailed information** about the vulnerability
4. **Allow time for fix** before public disclosure

## 🌍 Internationalization

To add new language support:

1. **Add translation files** in `app/frontend/src/locales/`
2. **Update language list** in configuration
3. **Test UI with new language**
4. **Update documentation**

## 📋 Review Criteria

Pull requests are evaluated on:

- **Code Quality**: Clean, readable, well-documented code
- **Functionality**: Features work as intended
- **Performance**: No significant performance regression
- **Security**: No security vulnerabilities introduced
- **Testing**: Adequate test coverage
- **Documentation**: Updated documentation where needed

## 🤝 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the project maintainers at conduct@dizipush.com.

## 📞 Getting Help

- **Documentation**: Check existing docs first
- **GitHub Discussions**: For general questions and discussions
- **GitHub Issues**: For bug reports and feature requests
- **Discord**: Join our community server (link in README)

## 🏆 Recognition

Contributors will be:
- Listed in our contributors section
- Credited in release notes for significant contributions
- Invited to join the core team for exceptional contributions

## 📄 License

By contributing to DiziPush, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to DiziPush! 🎉