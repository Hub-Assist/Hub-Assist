import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { get } from '@/lib/apiClient';
import { NOTIFICATION_READ_STORAGE_KEY, useNotifications } from '@/hooks/useNotifications';

jest.mock('@/lib/apiClient', () => ({ get: jest.fn() }));

const mockedGet = get as jest.MockedFunction<typeof get>;
const activities = [
  { id: 'booking-1', description: 'Booking confirmed', timestamp: '2026-07-20T09:00:00Z' },
  { id: 'attendance-1', description: 'Attendance anomaly', timestamp: '2026-07-20T10:00:00Z' },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useNotifications', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedGet.mockResolvedValue(activities);
  });

  it('derives unreadCount after merging activity with persisted read IDs', async () => {
    window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify({ 'booking-1': Date.now() }));
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.unreadCount).toBe(1);
  });

  it('persists a notification ID when it is marked as read', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => result.current.markAsRead('attendance-1'));

    expect(JSON.parse(window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY) ?? '{}')).toEqual(expect.objectContaining({ 'attendance-1': expect.any(Number) }));
    expect(result.current.unreadCount).toBe(1);
  });
});
