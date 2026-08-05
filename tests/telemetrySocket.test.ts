import { telemetrySocket } from '../src/websocket/socket';

describe('TelemetryWebSocket Real-time Broadcaster', () => {
  it('should initialize telemetrySocket singleton', () => {
    expect(telemetrySocket).toBeDefined();
  });

  it('should connect to WebSocket server without throwing unhandled runtime exceptions', () => {
    expect(() => telemetrySocket.connect()).not.toThrow();
  });
});
