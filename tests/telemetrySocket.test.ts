/**
 * TelemetryWebSocket tests.
 *
 * The socket transport is optional: the bundled agent serves no /ws endpoint, so the module must
 * stay dormant unless VITE_WS_URL is configured. It previously dialled `/ws` unconditionally, which
 * could never connect and left the UI flagged as permanently disconnected with no retry.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { telemetrySocket } from '../src/websocket/socket';
import { globalEventBus } from '../src/event-bus';

afterEach(() => {
  telemetrySocket.disconnect();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('telemetrySocket', () => {
  it('does not open a connection when VITE_WS_URL is unset', () => {
    // import.meta.env.VITE_WS_URL is empty in the test env, matching the default deployment.
    const WebSocketMock = vi.fn();
    vi.stubGlobal('WebSocket', WebSocketMock);

    telemetrySocket.connect();
    expect(WebSocketMock).not.toHaveBeenCalled();
  });

  it('reports itself as not connected while dormant', () => {
    expect(telemetrySocket.connected).toBe(false);
  });

  it('send() is a no-op that reports failure rather than throwing', () => {
    // The old implementation called this.socket.send() guarded only by a stale boolean flag, so a
    // send during reconnection threw on a null socket.
    expect(() => telemetrySocket.send('ping', {})).not.toThrow();
    expect(telemetrySocket.send('ping', {})).toBe(false);
  });

  it('disconnect() is safe to call when never connected', () => {
    expect(() => telemetrySocket.disconnect()).not.toThrow();
  });
});

describe('event bus telemetry contract', () => {
  it('carries the ws_connected flag the UI binds its status indicator to', () => {
    const handler = vi.fn();
    const unsubscribe = globalEventBus.on('ws_connected', handler);

    globalEventBus.emit('ws_connected', true);
    expect(handler).toHaveBeenCalledWith(true);

    unsubscribe();
  });
});
