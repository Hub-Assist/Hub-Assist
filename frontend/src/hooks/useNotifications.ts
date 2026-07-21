'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/store/authStore';
import { useToast } from '@/components/ui/ToastProvider';
import { env } from '@/utils/env';

const WS_URL = env.apiUrl.replace('/api', '');

export function useNotifications() {
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
