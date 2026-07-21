'use client';

import { useNotifications } from '@/hooks/useNotifications';

export function NotificationsInitializer() {
  useNotifications();
  return null;
}
