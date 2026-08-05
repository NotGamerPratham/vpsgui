import { globalEventBus } from '../event-bus';

const getWsUrl = (): string => {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl && !envUrl.includes('vpsgui.dev')) {
    return envUrl;
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  return 'ws://localhost:8080/ws';
};

class TelemetryWebSocket {
  private socket: WebSocket | null = null;
  private isConnected = false;

  connect() {
    try {
      this.socket = new WebSocket(getWsUrl());

      this.socket.onopen = () => {
        this.isConnected = true;
        globalEventBus.emit('ws_connected', true);
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          globalEventBus.emit(payload.event, payload.data);
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        globalEventBus.emit('ws_connected', false);
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        globalEventBus.emit('ws_connected', false);
      };
    } catch (e) {
      this.isConnected = false;
      globalEventBus.emit('ws_connected', false);
    }
  }

  send(event: string, data: any) {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify({ event, data }));
    }
  }
}

export const telemetrySocket = new TelemetryWebSocket();
