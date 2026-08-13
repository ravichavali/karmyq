const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a YYYY-MM-DD as UTC midnight. Returns NaN-bearing Date for anything else. */
function parseUtcDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return new Date(NaN);
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects real-looking but invalid dates such as 2026-02-31, which Date would roll over.
  return date.toISOString().slice(0, 10) === value ? date : new Date(NaN);
}

function todayUtc(now = new Date()) {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
}

/**
 * Validate a parsed registry against its caller-supplied rules.
 *
 * @returns {string[]} human-readable errors; empty means valid.
 */
function validateRegistry(registry, spec, now = new Date()) {
  const errors = [];
  const {
    collection,
    entryName,
    requiredFields,
    identity,
    fieldValidators,
    // Which fields hold YYYY-MM-DD dates is the SPEC's business, not the core's. Parsing a field
    // named `created` by name would silently mandate one audit-shaped field of every future
    // registry — the two shipped registries both happening to have it is what would hide that.
    dateFields = [],
    checkExpiry,
  } = spec;

  if (registry === null || typeof registry !== 'object' || Array.isArray(registry)) {
    return ['registry must be a JSON object'];
  }
  if (!Array.isArray(registry[collection])) {
    return [`registry.${collection} must be an array`];
  }

  const today = todayUtc(now);
  const seen = new Set();

  registry[collection].forEach((entry, index) => {
    const at = `${collection}[${index}]`;

    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${at}: must be an object`);
      return;
    }

    for (const field of requiredFields) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
        errors.push(`${at}: "${field}" is required and must be a non-empty string`);
      }
    }
    // Every later check reads these fields; bail rather than emit cascading noise.
    if (errors.some((message) => message.startsWith(`${at}:`))) return;

    for (const [field, validator] of Object.entries(fieldValidators)) {
      errors.push(...validator(entry[field], at));
    }

    const key = identity(entry);
    if (seen.has(key)) errors.push(`${at}: duplicate ${entryName} for ${key}`);
    seen.add(key);

    for (const field of dateFields) {
      if (Number.isNaN(parseUtcDate(entry[field]).getTime())) {
        errors.push(`${at}: "${field}" must be a valid YYYY-MM-DD date (got "${entry[field]}")`);
      }
    }

    for (const message of checkExpiry(entry, { now, today, parseUtcDate })) {
      errors.push(`${at}: ${message}`);
    }
  });

  return errors;
}

module.exports = { validateRegistry };
