export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Natural jittered delay — avoids metronomic behavior */
export async function naturalDelay(baseMs: number, jitterMs: number) {
  const actual = baseMs + Math.random() * jitterMs;
  return sleep(actual);
}

/** Pick true with given probability (0-1) */
export function chance(probability: number): boolean {
  return Math.random() < probability;
}
