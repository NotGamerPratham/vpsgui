import { create } from 'zustand';
import { globalEventBus } from '../event-bus';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'security';
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (item) => {
    const newNotif: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toLocaleTimeString(),
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

// Subscribe to real-time event bus for automated infrastructure alerts
globalEventBus.on('telemetry_tick', (data: any) => {
  if (!data) return;
  const store = useNotificationStore.getState();

  if (data.cpuPercent > 85) {
    // Throttled high CPU alert
    const lastCpuAlert = store.notifications.find((n) => n.title.includes('High CPU Load'));
    if (!lastCpuAlert || Date.now() - parseInt(lastCpuAlert.id.split('-')[1], 10) > 60000) {
      store.addNotification({
        title: 'High CPU Load Alert',
        message: `System CPU utilization surged to ${data.cpuPercent}%.`,
        type: 'warning',
      });
    }
  }

  if (data.ramPercent > 90) {
    const lastRamAlert = store.notifications.find((n) => n.title.includes('High Memory Alert'));
    if (!lastRamAlert || Date.now() - parseInt(lastRamAlert.id.split('-')[1], 10) > 60000) {
      store.addNotification({
        title: 'High Memory Alert',
        message: `System RAM utilization reached ${data.ramPercent}%.`,
        type: 'warning',
      });
    }
  }
});
