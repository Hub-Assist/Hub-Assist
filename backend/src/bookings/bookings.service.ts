import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { CreateBookingDto, UpdateBookingDto } from './bookings.dto';
import { StellarService } from '../stellar/stellar.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private repo: Repository<Booking>,
    private stellarService: StellarService,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    // Validate no overlapping bookings
    const overlapping = await this.repo.findOne({
      where: {
        workspaceId: dto.workspaceId,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (overlapping) {
      const overlap =
        (startTime < new Date(overlapping.endTime) && endTime > new Date(overlapping.startTime));
      if (overlap) {
        throw new BadRequestException('Workspace has overlapping bookings');
      }
    }

    const booking = this.repo.create({
      ...dto,
      userId,
      startTime,
      endTime,
      status: BookingStatus.PENDING,
    });

    return this.repo.save(booking);
  }

  async findAll(userId?: string, isAdmin: boolean = false) {
    const query = this.repo.createQueryBuilder('booking').leftJoinAndSelect('booking.workspace', 'workspace').leftJoinAndSelect('booking.user', 'user');

    if (!isAdmin && userId) {
      query.where('booking.userId = :userId', { userId });
    }

    return query.getMany();
  }

  async findById(id: string) {
    const booking = await this.repo.findOne({
      where: { id },
      relations: ['workspace', 'user'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async findByWorkspace(workspaceId: string) {
    return this.repo.find({
      where: { workspaceId },
      relations: ['user'],
    });
  }

  async confirm(id: string) {
    const booking = await this.findById(id);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only pending bookings can be confirmed');
    }

    // Verify on-chain payment
    if (!booking.stellarTxHash) {
      throw new BadRequestException('No transaction hash provided for payment verification');
    }

    try {
      const txVerification = await this.stellarService.verifyTransaction(booking.stellarTxHash);
      if (txVerification.status !== 'SUCCESS') {
        throw new BadRequestException('Transaction verification failed');
      }
    } catch (error) {
      throw new BadRequestException(`Payment verification failed: ${(error as Error).message}`);
    }

    booking.status = BookingStatus.CONFIRMED;
    return this.repo.save(booking);
  }

  async cancel(id: string) {
    const booking = await this.findById(id);
    booking.status = BookingStatus.CANCELLED;
    return this.repo.save(booking);
  }

  async update(id: string, dto: UpdateBookingDto) {
    const booking = await this.findById(id);
    Object.assign(booking, dto);
    return this.repo.save(booking);
  }
}
