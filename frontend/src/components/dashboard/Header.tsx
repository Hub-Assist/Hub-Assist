'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationCenter } from './NotificationCenter';

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, readIds, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#D7CFC6] bg-[#F3EBE2] px-4 py-3">
      <div className="flex items-center gap-3">
        <button onClick={onOpenMenu} aria-label="Open menu" className="rounded-lg p-1.5 text-[#6B6B6B] hover:bg-[#EDE2D6] hover:text-[#1A1A1A] lg:hidden">☰</button>
        <span className="text-base font-semibold text-[#1A1A1A]">Hubassist</span>
      </div>
      <div className="relative">
        <button type="button" onClick={() => setIsOpen((open) => !open)} aria-label="Notifications" aria-expanded={isOpen} className="relative rounded-lg p-2 text-[#6B6B6B] hover:bg-[#EDE2D6] hover:text-[#1A1A1A]">
          <Bell size={20} aria-hidden />
          {unreadCount > 0 && <span aria-label={`${unreadCount} unread notifications`} className="absolute -right-1 -top-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-[#B8612A] px-1 text-[11px] font-semibold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
        {isOpen && <NotificationCenter notifications={notifications} readIds={readIds} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} onDismiss={() => setIsOpen(false)} />}
      </div>
    </header>
  );
}
