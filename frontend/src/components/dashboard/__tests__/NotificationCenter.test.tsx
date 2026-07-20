import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationCenter } from '@/components/dashboard/NotificationCenter';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('NotificationCenter', () => {
  const props = {
    notifications: [{ id: 'booking-1', type: 'booking', description: 'Booking confirmed', timestamp: new Date().toISOString() }],
    readIds: new Set<string>(),
    onMarkAsRead: jest.fn(),
    onMarkAllAsRead: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('marks a notification read and navigates to its context page when clicked', () => {
    render(<NotificationCenter {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /booking confirmed/i }));

    expect(props.onMarkAsRead).toHaveBeenCalledWith('booking-1');
    expect(push).toHaveBeenCalledWith('/dashboard/bookings');
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('dismisses when Escape is pressed or the user clicks outside', () => {
    render(<><NotificationCenter {...props} /><button type="button">Outside</button></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(props.onDismiss).toHaveBeenCalledTimes(2);
  });
});
