/**
 * Structured JSON logger for the simulation.
 * Writes to stdout — Promtail picks up Docker container stdout and ships to Loki.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  service: string;
  level: LogLevel;
  persona?: string;
  workflow?: string;
  location?: string;
  duration_ms?: number;
  success?: boolean;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export function log(
  level: LogLevel,
  persona: string,
  message: string,
  extra: Record<string, unknown> = {}
) {
  const entry: LogEntry = {
    service: 'simulation',
    level,
    persona,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  console.log(JSON.stringify(entry));
}

export function logWorkflow(
  persona: string,
  workflow: string,
  location: string,
  durationMs: number,
  success: boolean,
  extra: Record<string, unknown> = {}
) {
  log(success ? 'info' : 'warn', persona, `workflow:${workflow}`, {
    workflow,
    location,
    duration_ms: durationMs,
    success,
    ...extra,
  });
}
