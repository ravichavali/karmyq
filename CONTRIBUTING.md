# Contributing to Karmyq

Thank you for your interest in contributing to Karmyq! This document provides guidelines and instructions for contributing.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/karmyq.git
   cd karmyq
   ```

3. **Install dependencies and start**
   ```bash
   ./scripts/dev/start.sh
   ```

4. **Make your changes**
5. **Submit a pull request**

## 📋 Development Workflow

See [docs/development/workflow.md](docs/development/workflow.md) for detailed workflow information.

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring

Example: `feature/add-skill-endorsements`

### Commit Messages

Follow conventional commits:

```
feat: add skill endorsement system
fix: resolve karma calculation bug
docs: update API documentation
refactor: simplify matching algorithm
```

## 🧪 Testing

All new code should include tests:

```bash
# Run all tests
npm test

# Run tests for specific service
cd services/auth-service
npm test
```

## 📚 Documentation

- Update relevant documentation in `docs/`
- Add API documentation for new endpoints
- Include code comments for complex logic

## 🎨 Code Style

- We use ESLint and Prettier
- Run linting before committing: `npm run lint`
- Format code: `npm run format`

## 🔍 Pull Request Process

1. Update documentation as needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md if applicable
5. Request review from maintainers

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All tests passing
- [ ] No merge conflicts

## 🐛 Reporting Bugs

Use GitHub Issues with the bug report template:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment details (OS, Docker version, etc.)

## 💡 Suggesting Features

Use GitHub Issues with the feature request template:

- Clear description of the feature
- Use case and benefits
- Possible implementation approach
- Mockups/diagrams if applicable

## 📖 Additional Resources

- [Full Documentation](docs/README.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Creating a Service](docs/development/creating-a-service.md)
- [API Documentation](docs/api/)

## ❓ Questions?

- Open a GitHub Discussion
- Check existing documentation
- Ask in pull request comments

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
