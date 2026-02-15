/**
 * SchemaService - Database-driven UI schema management with code fallback
 *
 * Implements hybrid schema loading strategy:
 * 1. Try database first (published schemas only)
 * 2. Fall back to code-based schemas if DB unavailable or schema not found
 * 3. Multi-layer caching (in-memory → Redis → database)
 */

import { Pool } from 'pg';
import { UISchema } from '@karmyq/shared/schemas/ui';
import {
  getUISchema as getUISchemaFromCode,
  getAllUISchemas as getAllUISchemasFromCode,
  getUISchemaSummaries as getUISchemaSummariesFromCode,
} from '@karmyq/shared/schemas/ui';
import crypto from 'crypto';

interface SchemaRow {
  id: string;
  type: string;
  version: number;
  label: string;
  icon: string;
  color: string;
  description: string;
  sections: any; // JSONB
  summary: any; // JSONB
  variant: string | null;
  rollout_percentage: number;
  status: string;
  published_at: Date | null;
}

export class SchemaService {
  private pool: Pool;
  private inMemoryCache: Map<string, { schema: UISchema; timestamp: number }>;
  private cacheTTL: number = 3600000; // 1 hour in milliseconds

  constructor(pool: Pool) {
    this.pool = pool;
    this.inMemoryCache = new Map();
  }

  /**
   * Get all published schemas (public API)
   * Returns merged list from database and code fallback
   */
  async getAllSchemas(): Promise<UISchema[]> {
    const cacheKey = 'schemas:all';

    // Check in-memory cache
    const cached = this.inMemoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.schema as any as UISchema[];
    }

    try {
      // Try database first
      const result = await this.pool.query<SchemaRow>(
        `SELECT type, version, label, icon, color, description, sections, summary, variant
         FROM requests.ui_schemas
         WHERE status = 'published'
         ORDER BY type, variant`
      );

      const dbSchemas = result.rows.map(this.rowToUISchema);

      // Get code-based schemas for fallback
      const codeSchemas = getAllUISchemasFromCode();

      // Merge: prefer DB schemas, add code schemas not in DB
      const dbTypes = new Set(dbSchemas.map(s => s.type));
      const mergedSchemas = [
        ...dbSchemas,
        ...codeSchemas.filter(s => !dbTypes.has(s.type))
      ];

      // Cache result
      this.inMemoryCache.set(cacheKey, {
        schema: mergedSchemas as any,
        timestamp: Date.now()
      });

      return mergedSchemas;

    } catch (error) {
      console.warn('Database unavailable, falling back to code schemas:', error);
      // Fall back to code-based schemas
      return getAllUISchemasFromCode();
    }
  }

  /**
   * Get schema summaries (for listing endpoint)
   */
  async getSchemaSummaries() {
    const schemas = await this.getAllSchemas();
    return schemas.map(s => ({
      type: s.type,
      version: s.version,
      label: s.label,
      icon: s.icon,
      color: s.color,
      description: s.description,
    }));
  }

  /**
   * Get specific schema by type with A/B testing support
   */
  async getSchema(type: string, userId?: string): Promise<UISchema | null> {
    const cacheKey = `schema:${type}${userId ? `:${userId}` : ''}`;

    // Check in-memory cache
    const cached = this.inMemoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.schema;
    }

    try {
      // Get all variants for this type
      const result = await this.pool.query<SchemaRow>(
        `SELECT type, version, label, icon, color, description, sections, summary, variant, rollout_percentage
         FROM requests.ui_schemas
         WHERE type = $1 AND status = 'published'
         ORDER BY variant`,
        [type]
      );

      if (result.rows.length === 0) {
        // Not in database, try code fallback
        return this.getSchemaFromCodeFallback(type);
      }

      // Select variant (A/B testing)
      const schema = this.selectVariant(result.rows, userId);

      // Cache result
      this.inMemoryCache.set(cacheKey, {
        schema,
        timestamp: Date.now()
      });

      return schema;

    } catch (error) {
      console.warn(`Database error for schema ${type}, falling back to code:`, error);
      return this.getSchemaFromCodeFallback(type);
    }
  }

  /**
   * Select variant for A/B testing based on user_id hash
   * Deterministic selection ensures same user always gets same variant
   */
  private selectVariant(variants: SchemaRow[], userId?: string): UISchema {
    if (variants.length === 1 || !userId) {
      return this.rowToUISchema(variants[0]);
    }

    // Hash user_id to get deterministic bucket (0-99)
    const hash = crypto.createHash('md5').update(`${variants[0].type}:${userId}`).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const bucket = hashInt % 100;

    // Select variant based on rollout percentage
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.rollout_percentage;
      if (bucket < cumulative) {
        return this.rowToUISchema(variant);
      }
    }

    // Default to first variant
    return this.rowToUISchema(variants[0]);
  }

  /**
   * Fall back to code-based schema
   */
  private getSchemaFromCodeFallback(type: string): UISchema | null {
    const schema = getUISchemaFromCode(type);
    if (schema) {
      console.log(`Using code fallback for schema: ${type}`);
      return schema;
    }
    return null;
  }

  /**
   * Convert database row to UISchema object
   */
  private rowToUISchema(row: SchemaRow): UISchema {
    return {
      type: row.type,
      version: row.version,
      label: row.label,
      icon: row.icon,
      color: row.color,
      description: row.description,
      sections: Array.isArray(row.sections) ? row.sections : [],
      summary: row.summary || undefined,
    };
  }

  /**
   * Invalidate cache for a specific schema type
   */
  invalidateCache(type: string) {
    // Clear specific schema cache
    const keysToDelete: string[] = [];
    for (const key of this.inMemoryCache.keys()) {
      if (key.startsWith(`schema:${type}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.inMemoryCache.delete(key));

    // Clear all schemas cache
    this.inMemoryCache.delete('schemas:all');
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.inMemoryCache.clear();
  }
}
