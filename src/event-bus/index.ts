import { TelemetryPoint } from '../types/monitoring';

/**
 * Payloads carried by each event.
 *
 * The bus was previously keyed by bare strings with `any` payloads, so every subscriber had to
 * re-declare `(data: any)` and typos in event names failed silently at runtime.
 */
export interface EventMap {
  /** A fresh telemetry sample from the poller (or a WebSocket backend, if configured). */
  telemetry_tick: TelemetryPoint;
  /** Whether live telemetry is currently arriving. */
  ws_connected: boolean;
}

export type EventName = keyof EventMap;
type EventCallback<K extends EventName> = (data: EventMap[K]) => void;

/** Erased callback type for internal storage; the public on()/emit() signatures stay typed. */
type AnyCallback = (data: never) => void;

class EventBus {
  private listeners = new Map<EventName, Set<AnyCallback>>();

  on<K extends EventName>(event: K, callback: EventCallback<K>): () => void {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(callback as AnyCallback);

    let removed = false;
    return () => {
      // Guard against double-unsubscribe: React 18 StrictMode runs effect cleanups twice, and a
      // second removal could otherwise drop a listener re-added in between.
      if (removed) return;
      removed = true;
      this.listeners.get(event)?.delete(callback as AnyCallback);
    };
  }

  emit<K extends EventName>(event: K, data: EventMap[K]): void {
    const bucket = this.listeners.get(event);
    if (!bucket) return;

    // Iterate a copy: a listener that unsubscribes (or subscribes) during dispatch must not
    // reshuffle the collection being walked.
    for (const cb of [...bucket]) {
      try {
        (cb as EventCallback<K>)(data);
      } catch (e) {
        // One misbehaving subscriber must not stop the rest from receiving the event.
        console.error(`EventBus listener for "${event}" threw:`, e);
      }
    }
  }
}

export const globalEventBus = new EventBus();
