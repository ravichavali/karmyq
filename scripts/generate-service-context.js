#!/usr/bin/env node
/**
 * Generate .claude/README.md for all services
 *
 * Uses services/registry.json as source of truth
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '../services/registry.json');

function loadRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function findConsumers(serviceName, registry) {
  const consumers = [];
  Object.entries(registry.services).forEach(([name, config]) => {
    if (config.dependencies?.services?.includes(serviceName)) {
      consumers.push(name);
    }
  });
  return consumers;
}

function generateServiceContext(serviceName, config, registry) {
  const consumers = findConsumers(serviceName, registry);
  const dependencies = config.dependencies?.services || [];
  const infrastructure = config.dependencies?.infrastructure || [];

  return `# ${serviceName} - Local Context

> **⚠️ CRITICAL**: When working in this directory, follow these steps EXACTLY.
> This is a ${config.criticality} service - ${consumers.length > 0 ? `impacts ${consumers.length} other service(s)` : 'no dependents'}.

## Quick Facts

- **Port**: ${config.port || 'N/A'}
- **Health Check**: ${config.health_check || 'N/A'}
- **Database Schema**: ${config.database_schemas?.join(', ') || 'None'}
- **Status**: ${config.status}
- **Criticality**: ${config.criticality}

## Service Dependencies

### This Service Depends On
${dependencies.length > 0 ? dependencies.map(d => `- ${d}`).join('\n') : '- None (foundation service)'}

### Infrastructure Dependencies
${infrastructure.map(i => `- ${i}`).join('\n')}

### Services That Depend On This
${consumers.length > 0 ? consumers.map(c => `- ${c} (${registry.services[c].criticality})`).join('\n') : '- None (leaf service)'}

${consumers.length > 0 ? `\n**⚠️ IMPACT**: If this service fails, ${consumers.length} service(s) will be affected!\n` : ''}

---

## ✅ MANDATORY: Before Making ANY Changes

### 1. Read Service Documentation
\`\`\`bash
# Read technical reference
cat CONTEXT.md

# Check service registry entry
cat ../../services/registry.json | jq '.services."${serviceName}"'

# View dependency graph
cat ../../services/dependency-graph.md
\`\`\`

### 2. Understand Impact Radius
\`\`\`bash
# Run impact analysis
cd ../.. && npm run analyze:services

# View impact report
cat services/impact-analysis.md | grep -A 10 "${serviceName}"
\`\`\`

### 3. Check Current Health
\`\`\`bash
${config.health_check ? `# Health check\ncurl -f ${config.health_check} || echo "Service is DOWN"\n` : '# No health check endpoint'}
# View recent logs (if using pm2)
pm2 logs ${serviceName} --lines 50 --nostream
\`\`\`

### 4. Run Tests
\`\`\`bash
# Unit tests
npm test

# Integration tests (from root)
cd ../../tests && npm run test:integration
\`\`\`

---

## 🔄 Development Workflow

### Step 1: Understand the Change
- [ ] Read CONTEXT.md for API documentation
- [ ] Check services/registry.json for dependencies
- [ ] Review recent commits: \`git log --oneline -10\`
- [ ] Search for similar code: \`grep -r "pattern" src/\`

### Step 2: Make Changes
- [ ] **NEVER skip reading files before editing**
- [ ] **ALWAYS understand existing patterns first**
- [ ] Use Read tool before Edit tool
- [ ] Follow existing code style

### Step 3: Test Changes
\`\`\`bash
# Run unit tests
npm test

# Start service locally
npm run dev

# Test API endpoints manually
${config.health_check ? `curl ${config.health_check}` : '# Use curl or Postman'}

# Check for errors in logs
pm2 logs ${serviceName} --lines 20
\`\`\`

### Step 4: Update Documentation
- [ ] Update CONTEXT.md if API changed
- [ ] Update services/registry.json if dependencies changed
- [ ] Add ADR if architectural decision made
- [ ] Update this .claude/README.md if workflow changed

### Step 5: Deploy
\`\`\`bash
# Build
npm run build

# Restart service
pm2 restart ${serviceName}

# Verify health
${config.health_check ? `curl -f ${config.health_check}` : 'pm2 status'}

# Monitor logs for errors
pm2 logs ${serviceName} --lines 50
\`\`\`

---

## 🔁 FEEDBACK LOOPS (Update Context)

### When You Create a New Endpoint
1. Add to CONTEXT.md "API Endpoints" section
2. Update services/registry.json "apis.provides" array
3. Run: \`npm run analyze:services\` to update graphs
4. If consumed by frontend: Document in apps/frontend/.claude/API_CHANGES.md

### When You Add a Dependency
1. Update package.json
2. Update services/registry.json "dependencies.services" array
3. Run: \`npm run analyze:services\` to detect circular deps
4. Update this .claude/README.md "Service Dependencies" section

### When You Find a Bug
1. Document in CONTEXT.md under "## Known Issues" section
2. Create issue in GitHub or add to docs/BUGS.md
3. If pattern is common: Add to "Common Mistakes" below

### When You Fix a Bug
1. Remove from CONTEXT.md "Known Issues"
2. Add to CONTEXT.md "## Recent Fixes" with date
3. If it was a repeated error: Update "Common Mistakes" with prevention tip

### When You Change Database Schema
1. Update infrastructure/postgres/init.sql
2. Update CONTEXT.md "Database Schema" section
3. Create migration script in infrastructure/postgres/migrations/
4. Document in ADR if significant change

### When You Add Event Publishing/Subscribing
1. Update services/registry.json "events" section
2. Update CONTEXT.md "Events" section
3. Run: \`npm run analyze:services\` to update event flow diagram
4. Verify consuming services are updated

---

## ❌ Common Mistakes to AVOID

### API Response Parsing
❌ **Don't**: Assume API responses are flat
\`\`\`typescript
const data = response.data; // WRONG - often nested
\`\`\`

✅ **Do**: Check actual response structure
\`\`\`typescript
const data = response.data.data || response.data; // Handle nesting
if (!Array.isArray(data)) throw new Error('Expected array');
\`\`\`

### File Operations
❌ **Don't**: Edit files without reading them first
❌ **Don't**: Assume file structure from memory

✅ **Do**: Use Read tool before Edit tool
✅ **Do**: Verify file exists and understand current state

### Testing
❌ **Don't**: Skip tests "because it's a small change"
❌ **Don't**: Assume tests still pass

✅ **Do**: Run tests before AND after changes
✅ **Do**: Add new tests for new functionality

### Dependency Management
❌ **Don't**: Add dependencies to service package.json
❌ **Don't**: Use different versions than root

✅ **Do**: Check if dependency is already in root package.json
✅ **Do**: Request hoisting if common dependency

### Error Handling
❌ **Don't**: Return 500 for validation errors
❌ **Don't**: Expose stack traces in production

✅ **Do**: Use 400 for client errors, 500 for server errors
✅ **Do**: Check NODE_ENV before exposing details

---

## 📋 Service-Specific Patterns

### API Response Format
All endpoints MUST return:
\`\`\`typescript
{
  success: boolean,
  data?: T,
  message?: string,
  error?: string // Only in development
}
\`\`\`

### Authentication
- JWT token in \`Authorization: Bearer <token>\` header
- Verified by authMiddleware from @karmyq/shared
- Token payload: \`{ userId: string, email: string, communityMemberships: [...] }\`

### Error Responses
\`\`\`typescript
{
  success: false,
  message: "Human-readable error",
  error: "VALIDATION_ERROR" // Error code
}
\`\`\`

### Logging
\`\`\`typescript
req.logger.info('Action performed', { userId, context });
req.logger.error('Error occurred', error, { userId, context });
\`\`\`

---

## 📂 File Organization

\`\`\`
${serviceName}/
├── .claude/
│   └── README.md          ← You are here
├── src/
│   ├── index.ts           ← Express app setup
│   ├── routes/            ← API route handlers
│   ├── services/          ← Business logic
│   ├── database/          ← DB queries
│   └── middleware/        ← Custom middleware (if any)
├── tests/
│   ├── unit/              ← Unit tests
│   └── integration/       ← Integration tests
├── CONTEXT.md             ← Technical reference
├── README.md              ← Human-readable overview
├── package.json
├── tsconfig.json
└── Dockerfile
\`\`\`

---

## 🔗 Reference Documents

### Service-Level
- **Technical Details**: [CONTEXT.md](./CONTEXT.md) (this directory)
- **Human Overview**: [README.md](./README.md) (this directory)

### System-Level
- **Architecture**: [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- **Service Registry**: [../../services/registry.json](../../services/registry.json)
- **Dependency Graph**: [../../services/dependency-graph.md](../../services/dependency-graph.md)
- **Impact Analysis**: [../../services/impact-analysis.md](../../services/impact-analysis.md)
- **Global Context**: [../../CLAUDE.md](../../CLAUDE.md)

### Decision Records
- **ADRs**: [../../docs/adr/](../../docs/adr/)
- **Roadmap**: [../../docs/archive/gemini-review/roadmap.md](../../docs/archive/gemini-review/roadmap.md)

---

## 🆘 Troubleshooting

### Service Won't Start
1. Check logs: \`pm2 logs ${serviceName}\`
2. Verify environment variables: \`cat .env\`
3. Test database connection: \`psql $DATABASE_URL -c "SELECT 1"\`
4. Check port availability: \`lsof -i :${config.port || 'PORT'}\`

### Tests Failing
1. Check if database is seeded: \`npm run seed\`
2. Verify environment: \`NODE_ENV=test npm test\`
3. Check test isolation: Each test should clean up
4. Review recent changes: \`git diff HEAD~1\`

### API Errors
1. Check request format matches CONTEXT.md
2. Verify authentication token is valid
3. Check database schema matches expectations
4. Review logs for detailed error messages

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
**Service Owner**: ${config.owner}
**Criticality**: ${config.criticality}
**Impact Radius**: ${consumers.length} dependent service(s)
`;
}

function main() {
  console.log('🔧 Generating .claude/README.md for all services...\n');

  const registry = loadRegistry();
  let created = 0;
  let skipped = 0;

  Object.entries(registry.services).forEach(([serviceName, config]) => {
    // Skip deprecated services
    if (config.status === 'deprecated') {
      console.log(`⊗ ${serviceName} - Skipped (deprecated)`);
      skipped++;
      return;
    }

    const servicePath = path.join(__dirname, '..', config.path);
    const claudeDir = path.join(servicePath, '.claude');
    const readmePath = path.join(claudeDir, 'README.md');

    // Create .claude directory
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Generate content
    const content = generateServiceContext(serviceName, config, registry);

    // Write file
    fs.writeFileSync(readmePath, content);
    console.log(`✓ ${serviceName} - Created .claude/README.md`);
    created++;
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Created ${created} service context file(s)`);
  console.log(`⊗ Skipped ${skipped} deprecated service(s)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Next steps:');
  console.log('1. Review generated .claude/README.md files');
  console.log('2. Test with one service (cd into service directory)');
  console.log('3. Update root CLAUDE.md to be a pointer document');
  console.log('4. Add context validation to pre-commit hook');
}

main();
