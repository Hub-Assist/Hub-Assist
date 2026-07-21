import { RefreshToken } from '../../auth/refresh-token.entity';
import { Attendance } from '../../attendance/attendance.entity';
import { Booking } from '../../bookings/booking.entity';
import { User } from '../user.entity';
import { UserSubscriber } from './user-subscriber';

describe('UserSubscriber', () => {
  it('soft-deletes bookings, refresh tokens, and attendance after user soft-remove', async () => {
    const dataSource = { subscribers: [] };
    const subscriber = new UserSubscriber(dataSource as any);
    const manager = { softDelete: jest.fn() };

    await subscriber.afterSoftRemove({
      entity: { id: 'user-1' } as User,
      manager,
    } as any);

    expect(manager.softDelete).toHaveBeenCalledWith(Booking, { userId: 'user-1' });
    expect(manager.softDelete).toHaveBeenCalledWith(RefreshToken, { userId: 'user-1' });
    expect(manager.softDelete).toHaveBeenCalledWith(Attendance, { userId: 'user-1' });
  });
});
