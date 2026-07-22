'use client';

import { useRealtimeNotifications } from '@/hooks/useNotifications';

export function NotificationsInitializer() {
  useRealtimeNotifications();
  return null;
}
