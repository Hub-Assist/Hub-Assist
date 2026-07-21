import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber, SoftRemoveEvent } from 'typeorm';
import { RefreshToken } from '../../auth/refresh-token.entity';
import { Attendance } from '../../attendance/attendance.entity';
import { Booking } from '../../bookings/booking.entity';
import { User } from '../user.entity';

@Injectable()
@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return User;
  }

  async afterSoftRemove(event: SoftRemoveEvent<User>) {
    const userId = event.entity?.id;
    if (!userId) {
      return;
    }

    await event.manager.softDelete(Booking, { userId });
    await event.manager.softDelete(RefreshToken, { userId });
    await event.manager.softDelete(Attendance, { userId });
  }
}
