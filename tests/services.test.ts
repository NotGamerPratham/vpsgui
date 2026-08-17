/**
 * Store and pure-logic tests.
 *
 * Per-service coverage lives in the sibling *Service.test.ts files; this file covers the shared
 * state layer — alert throttling and the notification store's identity/timestamp contract.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useNotificationStore } from '../src/store/useNotificationStore';
import { globalEventBus } from '../src/event-bus';
import { TelemetryPoint } from '../src/types/monitoring';

/** A complete telemetry sample with the fields under test overridden. */
function point(overrides: Partial<TelemetryPoint> = {}): TelemetryPoint {
  return {
    timestamp: new Date().toISOString(),
    cpuPercent: 5,
    ramPercent: 5,
    swapPercent: 0,
    diskPercent: 0,
    netRxKbps: 0,
    netTxKbps: 0,
    iowaitPercent: 0,
    ...overrides,
  };
}

beforeEach(() => {
  useNotificationStore.getState().clearAll();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useNotificationStore', () => {
  it('assigns unique ids even when notifications are added in the same millisecond', () => {
    const { addNotification } = useNotificationStore.getState();
    for (let i = 0; i < 50; i++) {
      addNotification({ title: `n${i}`, message: 'm', type: 'info' });
    }

    const ids = useNotificationStore.getState().notifications.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stores an ISO timestamp that can be parsed back', () => {
    // The store previously wrote toLocaleTimestring(), which cannot be parsed, sorted, or compared.
    useNotificationStore.getState().addNotification({ title: 't', message: 'm', type: 'info' });

    const [notif] = useNotificationStore.getState().notifications;
    expect(Number.isNaN(new Date(notif.timestamp).getTime())).toBe(false);
    expect(typeof notif.createdAt).toBe('number');
  });

  it('caps the backlog at 50 entries', () => {
    const { addNotification } = useNotificationStore.getState();
    for (let i = 0; i < 60; i++) {
      addNotification({ title: `n${i}`, message: 'm', type: 'info' });
    }
    expect(useNotificationStore.getState().notifications).toHaveLength(50);
  });

  it('tracks and clears the unread count', () => {
    const { addNotification } = useNotificationStore.getState();
    addNotification({ title: 'a', message: 'm', type: 'info' });
    addNotification({ title: 'b', message: 'm', type: 'info' });
    expect(useNotificationStore.getState().unreadCount).toBe(2);

    useNotificationStore.getState().markAllAsRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications.every((n) => n.read)).toBe(true);
  });
});

describe('telemetry alert throttling', () => {
  it('raises a CPU alert above the threshold', () => {
    globalEventBus.emit('telemetry_tick', point({ cpuPercent: 97, ramPercent: 20 }));

    const titles = useNotificationStore.getState().notifications.map((n) => n.title);
    expect(titles).toContain('High CPU Load Alert');
  });

  it('does not raise an alert below the threshold', () => {
    globalEventBus.emit('telemetry_tick', point({ cpuPercent: 10, ramPercent: 10 }));
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('throttles repeat CPU alerts inside the window', () => {
    for (let i = 0; i < 5; i++) {
      globalEventBus.emit('telemetry_tick', point({ cpuPercent: 99, ramPercent: 10 }));
    }

    const cpuAlerts = useNotificationStore
      .getState()
      .notifications.filter((n) => n.title === 'High CPU Load Alert');
    expect(cpuAlerts).toHaveLength(1);
  });

  it('raises CPU and RAM alerts independently', () => {
    globalEventBus.emit('telemetry_tick', point({ cpuPercent: 99, ramPercent: 99 }));

    const titles = useNotificationStore.getState().notifications.map((n) => n.title);
    expect(titles).toContain('High CPU Load Alert');
    expect(titles).toContain('High Memory Alert');
  });

  it('ignores a null payload and non-numeric readings', () => {
    // Deliberately malformed: the subscriber must survive a payload the type system forbids,
    // because it can still arrive from a WebSocket backend or an older agent.
    const emitRaw = globalEventBus.emit.bind(globalEventBus) as (event: string, data: unknown) => void;
    emitRaw('telemetry_tick', null);
    emitRaw('telemetry_tick', { cpuPercent: undefined, ramPercent: null });
    emitRaw('telemetry_tick', {});
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});

describe('globalEventBus', () => {
  it('delivers events to subscribers and stops after unsubscribe', () => {
    const handler = vi.fn();
    const unsubscribe = globalEventBus.on('ws_connected', handler);

    globalEventBus.emit('ws_connected', true);
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    globalEventBus.emit('ws_connected', false);
    // A leaked subscription here would keep unmounted components updating state forever.
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
