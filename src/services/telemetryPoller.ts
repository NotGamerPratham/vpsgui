/**
 * Real Telemetry Poller
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * The vpsgui-agent daemon is a plain HTTP server with no WebSocket support, so nothing ever emits a
 * live `telemetry_tick` over a socket. This module polls the REST telemetry endpoint and republishes
 * it on the shared event bus, so `telemetry_tick` listeners (dashboard chart, multi-VPS panels,
 * high CPU/RAM notifications) receive genuine data.
 *
 * It deliberately does NOT poll blindly. The agent locks out a client after repeated failed
 * authentication, so a fixed-interval poller holding a stale token re-arms that lockout forever and
 * takes the whole UI down with 429s. Auth failures stop the loop; transient failures back off.
 */

import { metricsService } from './metricsService';
import { globalEventBus } from '../event-bus';

const MAX_BACKOFF_MS = 60000;

let timer: ReturnType<typeof setTimeout> | null = null;
let refCount = 0;
let baseIntervalMs = 3000;
let consecutiveFailures = 0;
/** Set when the agent rejected our credentials. Polling stays stopped until explicitly resumed. */
let haltedReason: string | null = null;

/** Delay for the next poll: steady while healthy, exponential backoff once the agent is failing. */
function nextDelay(): number {
  if (consecutiveFailures === 0) return baseIntervalMs;
  return Math.min(baseIntervalMs * 2 ** consecutiveFailures, MAX_BACKOFF_MS);
}

function schedule() {
  if (refCount === 0 || haltedReason) return;
  timer = setTimeout(run, nextDelay());
}

async function run() {
  timer = null;
  if (refCount === 0) return;

  const { point, error } = await metricsService.fetchLiveTelemetryResult();

  if (point) {
    consecutiveFailures = 0;
    globalEventBus.emit('telemetry_tick', point);
    globalEventBus.emit('ws_connected', true);
  } else {
    globalEventBus.emit('ws_connected', false);

    if (error?.kind === 'auth') {
      // Retrying cannot succeed and keeps the agent's lockout armed. Stop and report.
      haltedReason = error.message;
      console.warn(`Telemetry polling halted: ${error.message}`);
      globalEventBus.emit('telemetry_halted', error.message);
      return;
    }
    consecutiveFailures += 1;
  }

  schedule();
}

/** True when polling stopped because of a credential/rate-limit problem. */
export function getTelemetryHaltReason(): string | null {
  return haltedReason;
}

/** Clear a halt and resume polling — call after the agent token is updated. */
export function resumeTelemetryPolling(): void {
  if (!haltedReason) return;
  haltedReason = null;
  consecutiveFailures = 0;
  if (refCount > 0 && !timer) run();
}

export function startTelemetryPolling(intervalMs = 3000): () => void {
  baseIntervalMs = intervalMs;
  refCount += 1;
  if (refCount === 1 && !timer && !haltedReason) run();

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
