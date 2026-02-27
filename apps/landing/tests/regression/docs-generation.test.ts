/**
 * Landing Page Documentation Generation — Regression Tests
 *
 * These tests validate the doc generation pipeline that feeds the /docs pages.
 * They run `generate-docs` then verify the output JSON files have the correct
 * structure and content. This catches:
 * - Missing services in the catalog
 * - Broken ADR parsing
 * - Missing navigation entries
 * - Schema contract violations in generated data
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const LANDING_DIR = path.join(__dirname, '..', '..');
const DOCS_DIR = path.join(LANDING_DIR, 'src', 'data', 'docs');

// Run doc generation before all tests
beforeAll(() => {
  execSync('npm run generate-docs', { cwd: LANDING_DIR, stdio: 'pipe' });
});

describe('Doc generation produces expected files', () => {
  const expectedFiles = [
    'services.json',
    'api.json',
    'architecture.json',
    'concepts.json',
    'nav.json',
  ];

  test.each(expectedFiles)('%s exists and is valid JSON', (file) => {
    const filePath = path.join(DOCS_DIR, file);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test('services directory contains individual service docs', () => {
    const servicesDir = path.join(DOCS_DIR, 'services');
    expect(fs.existsSync(servicesDir)).toBe(true);

    const files = fs.readdirSync(servicesDir);
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  test('concepts directory contains ADR docs', () => {
    const conceptsDir = path.join(DOCS_DIR, 'concepts');
    expect(fs.existsSync(conceptsDir)).toBe(true);

    const files = fs.readdirSync(conceptsDir);
    expect(files.length).toBeGreaterThanOrEqual(20);
  });
});

describe('Services catalog structure', () => {
  let data: { services: any[]; statistics: any };

  beforeAll(() => {
    data = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'services.json'), 'utf-8'));
  });

  test('contains at least 10 services', () => {
    expect(data.services.length).toBeGreaterThanOrEqual(10);
  });

  test('each service has required fields', () => {
    for (const service of data.services) {
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('port');
      expect(service).toHaveProperty('status');
      expect(service).toHaveProperty('criticality');
      expect(service).toHaveProperty('apis');
      expect(service).toHaveProperty('dependencies');
      expect(service).toHaveProperty('infrastructure');
      expect(service).toHaveProperty('events');
      expect(service).toHaveProperty('databaseSchemas');
      expect(Array.isArray(service.apis)).toBe(true);
      expect(Array.isArray(service.dependencies)).toBe(true);
    }
  });

  test('critical services are present', () => {
    const names = data.services.map((s: any) => s.name);
    expect(names).toContain('auth-service');
    expect(names).toContain('community-service');
    expect(names).toContain('request-service');
    expect(names).toContain('reputation-service');
    expect(names).toContain('social-graph-service');
  });

  test('has statistics', () => {
    expect(data.statistics).toBeDefined();
    expect(data.statistics.total_services).toBeGreaterThanOrEqual(10);
  });
});

describe('API reference structure', () => {
  let data: { groups: any[] };

  beforeAll(() => {
    data = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'api.json'), 'utf-8'));
  });

  test('has service groups', () => {
    expect(data.groups.length).toBeGreaterThanOrEqual(5);
  });

  test('each group has endpoints with method and path', () => {
    for (const group of data.groups) {
      expect(group).toHaveProperty('service');
      expect(group).toHaveProperty('endpoints');
      expect(Array.isArray(group.endpoints)).toBe(true);

      for (const ep of group.endpoints) {
        expect(ep).toHaveProperty('method');
        expect(ep).toHaveProperty('path');
        expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(ep.method);
        expect(ep.path).toMatch(/^\//);
      }
    }
  });
});

describe('Concepts structure', () => {
  let data: { concepts: any[] };

  beforeAll(() => {
    data = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'concepts.json'), 'utf-8'));
  });

  test('has at least 20 ADRs', () => {
    expect(data.concepts.length).toBeGreaterThanOrEqual(20);
  });

  test('each concept has required fields', () => {
    for (const concept of data.concepts) {
      expect(concept).toHaveProperty('slug');
      expect(concept).toHaveProperty('number');
      expect(concept).toHaveProperty('title');
      expect(concept).toHaveProperty('status');
      expect(concept).toHaveProperty('filename');
      expect(concept.slug).toMatch(/^adr-/);
    }
  });

  test('concepts have valid statuses', () => {
    const validStatuses = ['proposed', 'accepted', 'implemented', 'superseded', 'deprecated', 'unknown'];
    for (const concept of data.concepts) {
      expect(validStatuses).toContain(concept.status);
    }
  });

  test('individual concept files exist and have content', () => {
    // Check first 5
    for (const concept of data.concepts.slice(0, 5)) {
      const filePath = path.join(DOCS_DIR, 'concepts', `${concept.slug}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      const doc = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(doc).toHaveProperty('content');
      expect(doc.content.length).toBeGreaterThan(100);
    }
  });
});

describe('Navigation structure', () => {
  let data: { sections: any[] };

  beforeAll(() => {
    data = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'nav.json'), 'utf-8'));
  });

  test('has expected sections', () => {
    const titles = data.sections.map((s: any) => s.title);
    // Non-technical sections
    expect(titles).toContain('Why Karmyq');
    expect(titles).toContain('How It Works');
    expect(titles).toContain('User Guides');
    // Technical sections
    expect(titles).toContain('Architecture Decisions');
    expect(titles).toContain('API Reference');
    expect(titles).toContain('Services');
  });

  test('each section has items with label and href', () => {
    for (const section of data.sections) {
      expect(section.items.length).toBeGreaterThanOrEqual(1);
      for (const item of section.items) {
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('href');
        expect(item.href).toMatch(/^\/docs/);
      }
    }
  });

  test('Services section lists all services', () => {
    const servicesSection = data.sections.find((s: any) => s.title === 'Services');
    expect(servicesSection).toBeDefined();
    // "All Services" + individual services
    expect(servicesSection.items.length).toBeGreaterThanOrEqual(11);
  });
});

describe('Architecture doc', () => {
  test('has title and content', () => {
    const data = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'architecture.json'), 'utf-8'));
    expect(data).toHaveProperty('title');
    expect(data).toHaveProperty('content');
    expect(data.content.length).toBeGreaterThan(500);
  });
});
