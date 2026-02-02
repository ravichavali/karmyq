#!/usr/bin/env node
/**
 * Update all service .claude/README.md files to reflect TDD framework
 */

const fs = require('fs');
const path = require('path');

const SERVICES = [
  'cleanup-service',
  'community-service',
  'feed-service',
  'geocoding-service',
  'messaging-service',
  'notification-service',
  'reputation-service',
  'request-service',
  'simulation-service',
  'social-graph-service'
];

const OLD_TEST_SECTION = `### 4. Run Tests
\`\`\`bash
# Unit tests
npm test

# Integration tests (from root)
cd ../../tests && npm run test:integration
\`\`\``;

const NEW_TEST_SECTION = `### 4. Run Tests

**TDD Framework** (See [ADR-029](../../docs/adr/ADR-029-tdd-test-framework.md)):

\`\`\`bash
# Unit + regression tests (MUST pass before push)
npm test

# Individual test tiers
npm run test:unit        # Unit tests only
npm run test:regression  # Regression tests (locked-in behavior)
npm run test:tdd         # TDD/WIP tests (can fail)

# Integration tests (from root, requires database)
cd ../../tests && npm run test:integration
\`\`\`

**TDD Workflow**:
1. Write test in \`tests/tdd/\` first
2. Implement feature until test passes
3. Move passing test to \`tests/regression/\`
4. Test now MUST pass forever (locked in)`;

const OLD_FILE_STRUCTURE = `├── tests/
│   ├── unit/              ← Unit tests
│   └── integration/       ← Integration tests`;

const NEW_FILE_STRUCTURE = `├── tests/
│   ├── unit/              ← Unit tests (mocked, fast)
│   ├── regression/        ← Locked-in behavior (must pass)
│   ├── tdd/               ← Work-in-progress (can fail)
│   └── integration/       ← Integration tests (full stack)`;

const OLD_TESTING_PRACTICES = `### Testing
❌ **Don't**: Skip tests "because it's a small change"
❌ **Don't**: Assume tests still pass

✅ **Do**: Run tests before AND after changes
✅ **Do**: Add new tests for new functionality`;

const NEW_TESTING_PRACTICES = `### Testing (TDD Framework)
❌ **Don't**: Skip unit + regression tests (blocks push per ADR-029)
❌ **Don't**: Put WIP tests in regression/ (use tdd/ instead)
❌ **Don't**: Assume tests still pass after changes

✅ **Do**: Write tests in \`tdd/\` first (TDD approach)
✅ **Do**: Move passing tests to \`regression/\` (locked in)
✅ **Do**: Run \`npm test\` before push (unit + regression must pass)`;

let updated = 0;
let skipped = 0;

for (const service of SERVICES) {
  const filePath = path.join(__dirname, '..', 'services', service, '.claude', 'README.md');

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${service} (file not found)`);
    skipped++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Update test section
  if (content.includes(OLD_TEST_SECTION)) {
    content = content.replace(OLD_TEST_SECTION, NEW_TEST_SECTION);
    modified = true;
  }

  // Update file structure
  if (content.includes(OLD_FILE_STRUCTURE)) {
    content = content.replace(OLD_FILE_STRUCTURE, NEW_FILE_STRUCTURE);
    modified = true;
  }

  // Update testing practices
  if (content.includes(OLD_TESTING_PRACTICES)) {
    content = content.replace(OLD_TESTING_PRACTICES, NEW_TESTING_PRACTICES);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${service}`);
    updated++;
  } else {
    console.log(`ℹ️  ${service} already up to date`);
  }
}

console.log(`\n✅ Complete: ${updated} updated, ${skipped} skipped`);
