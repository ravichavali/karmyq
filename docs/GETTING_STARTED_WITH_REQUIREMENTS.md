# Getting Started with Requirements Management

Welcome to the Karmyq Requirements Management System! This guide will help you understand how we track and manage requirements, features, and tasks.

## System Overview

We use **GitHub Issues + Projects** for requirement and task management, combined with **versioned documentation** in the `/docs` folder.

```
GitHub Issues → Living backlog of work (tasks, bugs, features)
GitHub Projects → Visual tracking (Kanban board)
/docs/requirements → Detailed specifications (versioned with code)
GitHub Wiki → User guides and how-tos (coming soon)
```

## Creating New Work Items

### 1. Using Issue Templates

When you click **"New Issue"** on GitHub, you'll see these templates:

#### 🎯 **Epic** - Large features spanning multiple stories
Use for: Major capabilities like "Real-time Notifications", "Mobile App"
Example: "Implement federated communities"

#### 📖 **User Story** - User-facing features
Use for: Specific features from user perspective
Example: "As a user, I want to see who viewed my help request"

#### 🔧 **Technical Requirement** - System/architecture needs
Use for: Technical specs without direct user stories
Example: "Implement Redis caching layer"

#### 🐛 **Bug Report** - Things that are broken
Use for: Reporting issues or defects
Example: "Stats tab doesn't load on Firefox"

### 2. Labels

We use labels to categorize work:

**Type:**
- `epic` - Large multi-story features
- `feature` - New functionality
- `enhancement` - Improvements to existing features
- `bug` - Something broken
- `documentation` - Docs updates
- `technical-debt` - Code quality improvements

**Priority:**
- `priority:critical` - Blocking/urgent
- `priority:high` - Important
- `priority:medium` - Normal
- `priority:low` - Nice to have

**Status:**
- `status:blocked` - Can't proceed
- `status:in-review` - Under review
- `status:ready` - Ready to start

**Service:**
- `service:auth` - Auth service
- `service:community` - Community service
- `service:requests` - Request service
- (etc.)

### 3. Projects (Kanban Board)

Go to **Projects** tab to see the Kanban board:

```
📋 Backlog → 🎯 Ready → 🏗️ In Progress → 🧪 Testing → ✅ Done
```

**How to use:**
1. New issues start in **Backlog**
2. Move to **Ready** when prioritized
3. **In Progress** when actively working
4. **Testing** when code complete
5. **Done** when shipped to production

## Documentation Structure

### Requirements (`/docs/requirements/`)

#### Functional Requirements (What the system does)
- **FR-001**: Authentication
- **FR-002**: Community Management ✅ (documented)
- **FR-003**: Help Requests
- **FR-004**: Matching System
- etc.

#### Technical Requirements (How it works)
- **TR-001**: Microservices Architecture
- **TR-002**: Multi-Tenancy & RLS
- **TR-003**: Event-Driven Architecture
- etc.

#### Non-Functional Requirements (Quality attributes)
- **NFR-001**: Performance targets
- **NFR-002**: Security requirements
- **NFR-003**: Scalability goals
- etc.

### Features (`/docs/features/`)
Detailed feature specifications with:
- User flows
- UI mockups
- Business logic
- Edge cases

### Architecture (`/docs/architecture/`)
System design documentation:
- Architecture diagrams
- Data models
- API contracts
- Decision records (ADRs)

## Workflow

### For New Features

1. **Create Epic** (if large feature)
   - Use epic template
   - Define goals and success criteria
   - Break into user stories

2. **Create User Stories**
   - Use user story template
   - Link to parent epic
   - Add acceptance criteria

3. **Create Technical Requirements**
   - Define implementation approach
   - API/database changes
   - Migration strategy

4. **Write Detailed Spec** (in `/docs`)
   - Create requirement document (FR-XXX)
   - Include data models, APIs, security
   - Link to GitHub issues

5. **Implement**
   - Reference issue in commits: `fixes #123`
   - Update docs as you build
   - Write tests

6. **Review & Ship**
   - PR references issue
   - Tests pass
   - Documentation updated
   - Close issue when deployed

### For Bugs

1. **Create Bug Report**
   - Use bug template
   - Include reproduction steps
   - Add error logs/screenshots

2. **Triage**
   - Add priority label
   - Assign to milestone
   - Link to affected requirement

3. **Fix & Test**
   - Reference bug in commits
   - Add regression test
   - Update docs if needed

4. **Close**
   - Mark as resolved
   - Link to PR

## Best Practices

### ✅ DO

- **Link issues to commits**: Use `fixes #123` in commit messages
- **Update issues regularly**: Comment on progress
- **Write clear acceptance criteria**: Testable and specific
- **Keep requirements up to date**: Update docs when behavior changes
- **Cross-reference**: Link related issues and docs

### ❌ DON'T

- **Create duplicate issues**: Search first
- **Leave stale issues open**: Close or update
- **Forget to update docs**: Code + docs should match
- **Work without an issue**: Track all work
- **Skip acceptance criteria**: How do we know it's done?

## Quick Reference

### Create Issue
```
https://github.com/YOUR_USERNAME/karmyq/issues/new/choose
```

### View Project Board
```
https://github.com/YOUR_USERNAME/karmyq/projects
```

### Browse Requirements
```
/docs/requirements/REQUIREMENTS_INDEX.md
```

### Commit Message Examples
```bash
# Feature
git commit -m "feat: add community stats dashboard (#42)"

# Bug fix
git commit -m "fix: resolve stats query error (fixes #123)"

# Documentation
git commit -m "docs: update FR-002 with new settings (#45)"
```

## Next Steps

1. **Review existing requirements** in `/docs/requirements/`
2. **Check the backlog** on GitHub Issues
3. **Pick an issue** from the "Ready" column
4. **Create your first issue** using the templates

## Questions?

- Check the [Documentation Index](README.md)
- Ask in [GitHub Discussions](https://github.com/YOUR_USERNAME/karmyq/discussions)
- Read the [Contributing Guide](../CONTRIBUTING.md)

---

**Happy Building!** 🚀
