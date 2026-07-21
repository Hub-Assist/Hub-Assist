import { NotFoundException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { BookingStatus } from '../bookings/booking.entity';

describe('WorkspacesService', () => {
  const workspaceRepo = {
    save: jest.fn(),
    create: jest.fn((value) => value),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    manager: {
      transaction: jest.fn((cb) =>
        cb({
          update: jest.fn(),
          softDelete: jest.fn(),
        }),
      ),
    },
  };
  const bookingRepo = {
    find: jest.fn(),
  };
  const emailService = {
    sendWorkspaceBookingCancelled: jest.fn(),
  };

  let service: WorkspacesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkspacesService(workspaceRepo as any, bookingRepo as any, emailService as any);
  });

  it('cancels future confirmed bookings when a workspace is soft-deleted', async () => {
    const workspace = { id: 'workspace-1', name: 'Room A' };
    const transactionManager = {
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    workspaceRepo.findOne.mockResolvedValue(workspace);
    workspaceRepo.manager.transaction.mockImplementation((cb) => cb(transactionManager));
    bookingRepo.find.mockResolvedValue([
      {
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        user: { email: 'member@example.com' },
      },
    ]);

    await service.softDelete('workspace-1');

    expect(transactionManager.update).toHaveBeenCalledWith(
      expect.any(Function),
      ['booking-1'],
      { status: BookingStatus.CANCELLED },
    );
    expect(transactionManager.softDelete).toHaveBeenCalledWith(expect.any(Function), 'workspace-1');
    expect(emailService.sendWorkspaceBookingCancelled).toHaveBeenCalledWith('member@example.com', {
      bookingId: 'booking-1',
      workspaceName: 'Room A',
    });
  });

  it('throws when soft-deleting a missing workspace', async () => {
    workspaceRepo.findOne.mockResolvedValue(null);

    await expect(service.softDelete('missing')).rejects.toThrow(NotFoundException);
  });
});
