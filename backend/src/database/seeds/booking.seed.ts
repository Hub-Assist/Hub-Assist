import { DataSource } from 'typeorm';
import { Booking, BookingStatus } from '../../bookings/booking.entity';
import { User } from '../../users/user.entity';
import { Workspace } from '../../workspaces/workspace.entity';

export async function seedBookings(dataSource: DataSource, users: User[], workspaces: Workspace[]): Promise<void> {
  const repo = dataSource.getRepository(Booking);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(`  Bookings: skipped (${existing} already exist)`);
    return;
  }

  const members = users.filter(u => u.role === 'member');
  const now = new Date();

  const makeBooking = (
    user: User,
    workspace: Workspace,
    offsetDays: number,
    durationHours: number,
    status: BookingStatus,
  ) => {
    const start = new Date(now);
    start.setDate(start.getDate() + offsetDays);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + durationHours);
    const totalAmount = Number(workspace.pricePerHour) * durationHours;
    return repo.create({ userId: user.id, workspaceId: workspace.id, startTime: start, endTime: end, status, totalAmount });
  };

  const bookings = [
    makeBooking(members[0], workspaces[0], -5, 3, BookingStatus.COMPLETED),
    makeBooking(members[1], workspaces[1], -3, 8, BookingStatus.COMPLETED),
    makeBooking(members[2], workspaces[2], -1, 4, BookingStatus.CONFIRMED),
    makeBooking(members[3], workspaces[3], -2, 2, BookingStatus.CANCELLED),
    makeBooking(members[0], workspaces[1], 1, 6, BookingStatus.CONFIRMED),
    makeBooking(members[1], workspaces[2], 2, 3, BookingStatus.PENDING),
    makeBooking(members[2], workspaces[0], 3, 2, BookingStatus.PENDING),
    makeBooking(members[3], workspaces[3], 4, 1, BookingStatus.PENDING),
    makeBooking(members[4], workspaces[0], 5, 4, BookingStatus.CONFIRMED),
    makeBooking(members[4], workspaces[2], -7, 5, BookingStatus.COMPLETED),
  ];

  await repo.save(bookings);
  console.log(`  Bookings: created ${bookings.length}`);
}
