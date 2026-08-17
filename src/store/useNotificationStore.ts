import { create } from 'zustand';
import { globalEventBus } from '../event-bus';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  /** ISO-8601 timestamp. Format for display at render time, not at creation. */
  timestamp: string;
  /** Epoch ms, used for alert throttling without re-parsing the id. */
  createdAt: number;
  type: 'info' | 'warning' | 'error' | 'success' | 'security';
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'createdAt' | 'read'>) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

function newId(): string {
  // crypto.randomUUID is unavailable on insecure origins; fall back to a random suffix.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `notif-${crypto.randomUUID()}`;
  }
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (item) => {
    const now = Date.now();
    const newNotif: NotificationItem = {
      ...item,
      id: newId(),
      timestamp: new Date(now).toISOString(),
      createdAt: now,
      read: false,
    };

    set((state) => ({
      notifications: [newNotif, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

const ALERT_THROTTLE_MS = 60000;
const CPU_ALERT_THRESHOLD = 85;
const RAM_ALERT_THRESHOLD = 90;

/** True when no alert with this title has fired inside the throttle window. */
function shouldAlert(title: string): boolean {
  const last = useNotificationStore.getState().notifications.find((n) => n.title === title);
  return !last || Date.now() - last.createdAt > ALERT_THROTTLE_MS;
}

// Subscribe to the telemetry event bus for automated infrastructure alerts
globalEventBus.on('telemetry_tick', (data: any) => {
  // Guard against null readings: `undefined > 85` is false, but an explicit check keeps the
  // intent clear and avoids alerting on a partial payload.
  if (!data) return;

  if (typeof data.cpuPercent === 'number' && data.cpuPercent > CPU_ALERT_THRESHOLD) {
    const title = 'High CPU Load Alert';
    if (shouldAlert(title)) {
      useNotificationStore.getState().addNotification({
        title,
        message: `System CPU utilization surged to ${data.cpuPercent}%.`,
        type: 'warning',
      });
    }
  }

  if (typeof data.ramPercent === 'number' && data.ramPercent > RAM_ALERT_THRESHOLD) {
    const title = 'High Memory Alert';
    if (shouldAlert(title)) {
      useNotificationStore.getState().addNotification({
        title,
        message: `System RAM utilization reached ${data.ramPercent}%.`,
        type: 'warning',
      });
    }
  }
});
