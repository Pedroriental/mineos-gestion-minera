'use client';

import { BellRing, Check, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const isUnread = !notification.read_at;

  return (
    <button
      onClick={onClick}
      className={cn(
        'app-popover-item flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        isUnread && 'bg-[var(--dashboard-accent-soft)]/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
          isUnread
            ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
            : 'border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] text-[var(--dashboard-text-muted)]',
        )}
      >
        <BellRing className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[12px] leading-snug',
            isUnread
              ? 'font-semibold text-[var(--dashboard-text)]'
              : 'font-medium text-[var(--dashboard-text-muted)]',
          )}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-0.5 truncate text-[11px] text-[var(--dashboard-text-muted)]">
            {notification.body}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-[var(--dashboard-text-muted)]/60">
          {new Date(notification.created_at).toLocaleString('es-EC', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      {isUnread && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
      )}
    </button>
  );
}

export function NotificationPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.href) {
      router.push(notification.href);
    }
    onClose();
  };

  return (
    <div className="app-popover bell-panel w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--dashboard-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--dashboard-text-muted)]">
            Notificaciones
          </span>
          {unreadCount > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-card-muted)] hover:text-[var(--dashboard-text)]"
              title="Marcar todo como leído"
            >
              <CheckCheck className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-lg leading-none text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text-secondary)]"
          >
            &times;
          </button>
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto p-1.5">
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onClick={() => handleClick(n)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--dashboard-card-muted)] text-[var(--dashboard-text-muted)]">
              <BellRing className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-medium text-[var(--dashboard-text-secondary)]">
              Todo está en orden
            </p>
            <p className="text-[11px] text-[var(--dashboard-text-muted)]">
              No tienes notificaciones pendientes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
