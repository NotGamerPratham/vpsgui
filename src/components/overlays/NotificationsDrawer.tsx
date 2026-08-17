import React from 'react';
import { X, Bell, AlertTriangle, CheckCircle2, Info, ShieldAlert, Trash2 } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Button } from '../ui/button';

export function NotificationsDrawer() {
  const { notificationsOpen, setNotificationsOpen } = useUIStore();
  const { notifications, unreadCount, markAllAsRead, clearAll } = useNotificationStore();

  if (!notificationsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setNotificationsOpen(false)} />

      <div className="relative z-50 h-full w-full max-w-md border-l border-border bg-card shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">Real-Time Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-mono font-bold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <button onClick={() => setNotificationsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-foreground">No Active System Notifications</p>
              <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                Real-time alerts will trigger automatically when high memory, CPU thresholds, or agent events occur.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              let Icon = Info;
              let iconColor = 'text-primary';
              if (n.type === 'warning') {
                Icon = AlertTriangle;
                iconColor = 'text-amber-400';
              } else if (n.type === 'error') {
                Icon = ShieldAlert;
                iconColor = 'text-rose-400';
              } else if (n.type === 'success') {
                Icon = CheckCircle2;
                iconColor = 'text-emerald-400';
              }

              return (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3.5 space-y-1 transition-colors ${
                    n.read ? 'border-border/60 bg-muted/20' : 'border-primary/40 bg-primary/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                      <span className="font-semibold text-xs text-foreground">{n.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground" title={n.timestamp}>
                      {new Date(n.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-4 border-t border-border flex justify-between items-center text-xs">
          {notifications.length > 0 ? (
            <div className="flex items-center space-x-3">
              <button onClick={markAllAsRead} className="text-primary hover:underline font-medium">
                Mark all as read
              </button>
              <button onClick={clearAll} className="text-rose-400 hover:underline flex items-center gap-1 font-medium">
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">Listening on /ws socket stream</span>
          )}
          <Button size="sm" variant="ghost" onClick={() => setNotificationsOpen(false)} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
