/**
 * Telemetry WebSocket Transport
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * OPTIONAL transport. The bundled vpsgui-agent daemon is a plain HTTP server and does NOT serve a
 * WebSocket endpoint — live telemetry is delivered by `services/telemetryPoller.ts` instead.
 *
 * This module stays dormant unless VITE_WS_URL is explicitly configured, which is the case only
 * when a custom backend that speaks the telemetry protocol is deployed. Previously it unconditionally
 * dialled `/ws`, which could never connect and left the UI permanently flagged as disconnected while
 * retrying nothing.
 */

import { globalEventBus } from '../event-bus';

const INITIAL_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;

/** Returns the configured endpoint, or null when no WebSocket backend is deployed. */
const getWsUrl = (): string | null => {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (!envUrl || !envUrl.trim()) return null;
  return envUrl.trim();
};

class TelemetryWebSocket {
  private socket: WebSocket | null = null;
  private reconnectDelay = INITIAL_RECONNECT_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /** No-op when VITE_WS_URL is unset, so the polling transport stays the single source of truth. */
  connect(): void {
    const url = getWsUrl();
    if (!url) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldReconnect = true;

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        this.reconnectDelay = INITIAL_RECONNECT_MS;
        globalEventBus.emit('ws_connected', true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          // Only dispatch well-formed frames; a malformed one must not crash the bus.
          if (payload && typeof payload.event === 'string') {
            globalEventBus.emit(payload.event, payload.data);
          }
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      };

      socket.onerror = () => {
        globalEventBus.emit('ws_connected', false);
      };

      // onclose fires after onerror too, so schedule the retry from a single place.
      socket.onclose = () => {
        globalEventBus.emit('ws_connected', false);
        this.socket = null;
        this.scheduleReconnect();
      };
    } catch (e) {
      globalEventBus.emit('ws_connected', false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Exponential backoff, so a downed backend is not hammered every second.
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  send(event: string, data: unknown): boolean {
    if (!this.connected || !this.socket) return false;
    this.socket.send(JSON.stringify({ event, data }));
    return true;
  }
}

export const telemetrySocket = new TelemetryWebSocket();
