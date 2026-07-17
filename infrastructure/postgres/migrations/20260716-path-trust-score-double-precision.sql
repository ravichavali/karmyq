-- BUG-030: effective trust scores include decay-derived fractional values, so the
-- cache column must preserve the score rather than coercing it to an integer.
ALTER TABLE auth.social_distances
  ALTER COLUMN path_trust_score TYPE DOUBLE PRECISION;
