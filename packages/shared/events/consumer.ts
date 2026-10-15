import Queue from 'bull';
import { consumerQueueName, eventsFor, EventConsumer } from './routes';

export type EventHandler = (job: Queue.Job) => Promise<void>;

/**
 * Attach a service's handlers to its own queue (ADR-101). Refuses to start unless the handler names
 * equal the routing table's events for `consumer` exactly: a missing handler would fail every routed
 * job, and an unrouted one is dead code on a queue that never receives it. Validation runs before any
 * worker attaches. `legacyQueue` (the old shared `karmyq-events`) gets the same handlers for one release
 * so jobs published before the deploy still drain; other services' legacy workers can still take them.
 */
export function startConsumerQueue(
  consumer: EventConsumer,
  handlers: Readonly<Record<string, EventHandler>>,
  redisUrl: string,
  legacyQueue?: Pick<Queue.Queue, 'process'>,
): Queue.Queue {
  const name = consumerQueueName(consumer);
  const expected = eventsFor(consumer);
  const actual = Object.keys(handlers).sort();
  const missing = expected.filter((n) => !actual.includes(n));
  const unrouted = actual.filter((n) => !expected.includes(n));
  if (missing.length || unrouted.length) {
    throw new Error(`${name} handlers do not match EVENT_ROUTES: missing [${missing.join(', ')}], unrouted [${unrouted.join(', ')}]`);
  }
  const queue = new Queue(name, redisUrl);
  queue.on('error', (error) => console.error(`${name} queue error:`, error));
  for (const event of expected) {
    queue.process(event, handlers[event]);
    legacyQueue?.process(event, handlers[event]);
  }
  return queue;
}
