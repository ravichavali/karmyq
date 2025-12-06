#!/usr/bin/env node

/**
 * Script to standardize API responses across all route files
 * Converts res.json() and res.status().json() to standardized helpers
 */

const fs = require('fs');
const path = require('path');

const replacements = [
  // Validation errors (400)
  {
    pattern: /res\.status\(400\)\.json\(\{\s*success:\s*false,\s*message:\s*['"]([^'"]+)['"]\s*\}\)/gs,
    replacement: (match, message) => `sendValidationError(res, '${message}', { requestId: (req as any).id })`
  },

  // Unauthorized (401)
  {
    pattern: /res\.status\(401\)\.json\(\{\s*success:\s*false,\s*message:\s*['"]([^'"]+)['"]\s*\}\)/gs,
    replacement: (match, message) => `sendUnauthorized(res, '${message}', { requestId: (req as any).id })`
  },

  // Forbidden (403)
  {
    pattern: /res\.status\(403\)\.json\(\{\s*success:\s*false,\s*message:\s*['"]([^'"]+)['"]\s*\}\)/gs,
    replacement: (match, message) => `sendForbidden(res, '${message}', { requestId: (req as any).id })`
  },

  // Not Found (404)
  {
    pattern: /res\.status\(404\)\.json\(\{\s*success:\s*false,\s*message:\s*['"]([^'"]+)['"]\s*\}\)/gs,
    replacement: (match, message) => `sendNotFound(res, '${message}', { requestId: (req as any).id })`
  },

  // Internal Server Error (500) with error object
  {
    pattern: /res\.status\(500\)\.json\(\{\s*success:\s*false,\s*message:\s*['"]([^'"]+)['"],\s*error:\s*error\.message\s*\}\)/gs,
    replacement: (match, message) => `sendInternalError(res, '${message}', error instanceof Error ? error : undefined, { requestId: (req as any).id })`
  },

  // Created (201) with data
  {
    pattern: /res\.status\(201\)\.json\(\{\s*success:\s*true,\s*data:\s*(\w+)/gs,
    replacement: (match, dataVar) => `sendSuccess(res, ${dataVar}`
  },

  // Success (200) with message only
  {
    pattern: /res\.json\(\{\s*success:\s*true,\s*message:\s*['"]([^'"]+)['"]\s*\}\)/gs,
    replacement: (match, message) => `sendSuccess(res, { message: '${message}' }, HTTP_STATUS.OK, { requestId: (req as any).id })`
  }
];

function updateFile(filePath) {
  console.log(`Processing: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if imports already exist
  const hasImports = content.includes('sendSuccess') && content.includes('sendError');

  if (!hasImports) {
    // Add imports after other imports
    const importBlock = `import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendConflict,
  sendInternalError,
  HTTP_STATUS
} from '../../shared/utils/response';
`;

    // Insert after last import
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLineIndex = content.indexOf('\n', lastImportIndex);
    content = content.slice(0, endOfLineIndex + 1) + importBlock + '\n' + content.slice(endOfLineIndex + 1);
    modified = true;
  }

  // Apply replacements
  replacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  } else {
    console.log(`  No changes needed: ${filePath}`);
    return false;
  }
}

// Process files
const files = [
  'services/request-service/src/routes/requests.ts',
  'services/request-service/src/routes/matches.ts',
  'services/request-service/src/routes/offers.ts'
];

let totalUpdated = 0;
files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    if (updateFile(fullPath)) {
      totalUpdated++;
    }
  } else {
    console.log(`✗ File not found: ${fullPath}`);
  }
});

console.log(`\nCompleted! ${totalUpdated} files updated.`);
