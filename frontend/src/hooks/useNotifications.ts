'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/store/authStore';
import { useToast } from '@/components/ui/ToastProvider';
import { env } from '@/utils/env';
import { get } from '@/lib/apiClient';

const WS_URL = env.apiUrl.replace('/api', '');
export const NOTIFICATION_READ_STORAGE_KEY = 'hubassist:read-notification-ids';
export const READ_NOTIFICATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface Notification {
  id: string;
  icon?: string;
  description: string;
  timestamp: string;
  type?: 'booking' | 'membership' | 'attendance' | string;
  contextPath?: string;
}

type ReadNotificationStore = Record<string, number>;

function readStoredNotificationStore(now = Date.now()): ReadNotificationStore {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    const stored: ReadNotificationStore = Array.isArray(parsed)
      ? Object.fromEntries(parsed.filter((id): id is string => typeof id === 'string').map((id) => [id, now]))
      : parsed && typeof parsed === 'object' ? parsed as ReadNotificationStore : {};
    const retained = Object.fromEntries(
      Object.entries(stored).filter(([, readAt]) => typeof readAt === 'number' && now - readAt <= READ_NOTIFICATION_MAX_AGE_MS),
    );
    window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(retained));
    return retained;
  } catch {
    return {};
  }
}

export function readStoredNotificationIds(now = Date.now()): Set<string> {
  return new Set(Object.keys(readStoredNotificationStore(now)));
}

function persistReadNotificationIds(ids: Set<string>, now = Date.now()) {
  if (typeof window === 'undefined') return;
  const value = readStoredNotificationStore(now);
  ids.forEach((id) => {
    if (!value[id]) value[id] = now;
  });
  window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(value));
}

/** Dashboard activity with local, browser-persisted read state. */
export function useNotifications() {
  const [readIds, setReadIds] = useState<Set<string>>(() => readStoredNotificationIds());
  const query = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => get<Notification[]>('/dashboard/activity'),
  });
  const notifications = query.data ?? [];

  const markAsRead = useCallback((id: string) => {
    setReadIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      persistReadNotificationIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const ids = new Set(notifications.map((notification) => notification.id));
    setReadIds((current) => {
      const next = new Set([...current, ...ids]);
      persistReadNotificationIds(next);
      return next;
    });
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !readIds.has(notification.id)).length,
    [notifications, readIds],
  );

  return { ...query, notifications, readIds, unreadCount, markAsRead, markAllAsRead };
}

/** Existing socket toast notifications, kept separate from dashboard activity state. */
export function useRealtimeNotifications() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const { showToast } = useToast();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io(`${WS_URL}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('booking:confirmed', (data: { bookingId: string; workspaceName?: string }) => {
      showToast('success', `Booking confirmed${data.workspaceName ? ` for ${data.workspaceName}` : ''}`);
    });

    socket.on('booking:cancelled', () => {
      showToast('warning', 'Your booking has been cancelled');
    });

    socket.on('member:registered', (data: { email: string }) => {
      showToast('success', `New member registered: ${data.email}`);
    });

    socket.on('otp:sent', () => {
      showToast('success', 'OTP sent to your email');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken, showToast]);

  return socketRef;
}
