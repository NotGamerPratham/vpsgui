import React from 'react';
import { X, Bell, AlertTriangle, CheckCircle2, Info, ShieldAlert, Cpu } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';

export function NotificationsDrawer() {
  const { notificationsOpen, setNotificationsOpen } = useUIStore();

  if (!notificationsOpen) return null;

  const notifications = [
    {
      id: 'notif-1',
      title: 'High RAM Threshold Warning',
      message: 'Node vps-eu-central-db-01 memory utilization reached 84%.',
      time: '10 mins ago',
      type: 'warning',
      icon: Cpu,
    },
    {
      id: 'notif-2',
      title: 'Docker Container Restarted',
      message: 'nginx-proxy-manager container healthcheck passed after auto restart.',
      time: '24 mins ago',
      type: 'success',
      icon: CheckCircle2,
    },
    {
      id: 'notif-3',
      title: 'Firewall Block Event',
      message: 'Fail2ban blocked IP 185.220.101.5 after 5 failed SSH password attempts.',
      time: '1 hour ago',
      type: 'security',
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setNotificationsOpen(false)} />

      <div className="relative z-50 h-full w-full max-w-md border-l border-border bg-card shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">Notifications & Alerts</h3>
          </div>
          <button onClick={() => setNotificationsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {notifications.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-1 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-amber-400" />
                    <span className="font-semibold text-xs text-foreground">{n.title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{n.time}</span>
                </div>
                <p className="text-xs text-muted-foreground">{n.message}</p>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border flex justify-between items-center text-xs">
          <button className="text-primary hover:underline">Mark all as read</button>
          <button onClick={() => setNotificationsOpen(false)} className="text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
