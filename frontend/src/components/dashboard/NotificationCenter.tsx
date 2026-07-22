'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/hooks/useNotifications';

interface NotificationCenterProps {
  notifications: Notification[];
  readIds: Set<string>;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: () => void;
}

export function notificationContextPath(notification: Notification): string {
  if (notification.contextPath) return notification.contextPath;
  if (notification.type === 'booking' || /booking/i.test(notification.description)) return '/dashboard/bookings';
  if (notification.type === 'attendance' || /attendance|clock.?in|clock.?out/i.test(notification.description)) return '/dashboard/attendance';
  return '/profile';
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationCenter({ notifications, readIds, onMarkAsRead, onMarkAllAsRead, onDismiss }: NotificationCenterProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);

  return (
    <div ref={panelRef} role="dialog" aria-label="Notification center" className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#D7CFC6] bg-[#FDF9F5] shadow-xl">
      <div className="flex items-center justify-between border-b border-[#EDE2D6] px-4 py-3">
        <h2 className="font-semibold text-[#1A1A1A]">Notifications</h2>
        <button type="button" onClick={onMarkAllAsRead} disabled={!notifications.some((item) => !readIds.has(item.id))} className="text-xs font-medium text-[#7A4E2D] disabled:cursor-not-allowed disabled:opacity-50">
          Mark all read
        </button>
      </div>
      {notifications.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[#6B6B6B]">You&apos;re all caught up.</p>
      ) : (
        <ul className="max-h-[24rem] overflow-y-auto py-1">
          {notifications.map((notification) => {
            const unread = !readIds.has(notification.id);
            return <li key={notification.id}>
              <button type="button" onClick={() => { onMarkAsRead(notification.id); router.push(notificationContextPath(notification)); onDismiss(); }} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#F3EBE2] ${unread ? 'bg-[#F8EFE5]' : ''}`}>
                <span aria-hidden className="mt-0.5 text-base">{notification.icon ?? '•'}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm text-[#1A1A1A]">{notification.description}</span><span className="mt-1 block text-xs text-[#6B6B6B]">{timeAgo(notification.timestamp)}</span></span>
                {unread && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#B8612A]" />}
              </button>
            </li>;
          })}
        </ul>
      )}
    </div>
  );
}
