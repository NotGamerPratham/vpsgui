/**
 * Real Telemetry Poller
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * The vpsgui-agent daemon is a plain HTTP server with no WebSocket support, so there is nothing
 * that ever emits a live `telemetry_tick` event over a socket. This module polls the real REST
 * telemetry endpoint on an interval and republishes it on the shared event bus, so existing
 * `telemetry_tick` listeners (dashboard chart, multi-VPS panels, high CPU/RAM notifications) get
 * genuine data instead of waiting forever on a transport that was never implemented server-side.
 */

import { metricsService } from './metricsService';
import { globalEventBus } from '../event-bus';

let intervalId: ReturnType<typeof setInterval> | null = null;
let refCount = 0;

async function tick() {
  const point = await metricsService.fetchLiveTelemetry();
  if (point) {
    globalEventBus.emit('telemetry_tick', point);
    globalEventBus.emit('ws_connected', true);
  } else {
    globalEventBus.emit('ws_connected', false);
  }
}

export function startTelemetryPolling(intervalMs = 3000): () => void {
  refCount += 1;
  if (!intervalId) {
    tick();
    intervalId = setInterval(tick, intervalMs);
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
