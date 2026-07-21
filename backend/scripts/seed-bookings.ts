import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BookingsService } from '../src/bookings/bookings.service';
import { BookingStatus } from '../src/bookings/booking.entity';
import { Workspace } from '../src/workspaces/workspace.entity';
import { User } from '../src/users/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const args = process.argv.slice(2);
  let count = 100000;
  for (const arg of args) {
    if (arg.startsWith('--count=')) {
      count = parseInt(arg.split('=')[1], 10);
    }
  }

  const workspaceRepo = app.get<Repository<Workspace>>(getRepositoryToken(Workspace));
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const bookingsService = app.get(BookingsService);

  // Get or create a user and workspace
  let user = await userRepo.findOne({ where: {} });
  if (!user) {
    user = await userRepo.save({
      email: 'seed' + Date.now() + '@example.com',
      passwordHash: 'hashed',
      firstName: 'Seed',
      lastName: 'User',
      isVerified: true
    });
  }

  let workspace = await workspaceRepo.findOne({ where: {} });
  if (!workspace) {
    workspace = await workspaceRepo.save({
      name: 'Seed Workspace',
      type: 'HotDesk',
      capacity: 10,
      pricePerHour: 15.00,
      availability: 'Available',
      amenities: []
    });
  }

  console.log(`Seeding ${count} bookings...`);
  
  // Create raw inserts to be fast
  const bookingRepo = app.get<Repository<any>>(getRepositoryToken(BookingStatus) as any); // hack to get repo? No, use direct query runner
  
  const queryRunner = workspaceRepo.manager.connection.createQueryRunner();
  await queryRunner.connect();

  const batchSize = 5000;
  let values = [];
  
  const baseTime = new Date('2025-01-01T00:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    // Generate non-overlapping times
    const start = new Date(baseTime + i * 3600000); // 1 hour per booking
    const end = new Date(baseTime + i * 3600000 + 1800000); // 30 mins long
    
    values.push(`(
      uuid_generate_v4(), 
      '${workspace.id}', 
      '${user.id}', 
      '${start.toISOString()}', 
      '${end.toISOString()}', 
      'Confirmed', 
      15.00, 
      now(), 
      now()
    )`);

    if (values.length >= batchSize) {
      await queryRunner.query(`
        INSERT INTO bookings ("id", "workspaceId", "userId", "startTime", "endTime", "status", "totalAmount", "createdAt", "updatedAt")
        VALUES ${values.join(',')}
      `);
      values = [];
      console.log(`Inserted ${i + 1} records`);
    }
  }

  if (values.length > 0) {
    await queryRunner.query(`
      INSERT INTO bookings ("id", "workspaceId", "userId", "startTime", "endTime", "status", "totalAmount", "createdAt", "updatedAt")
      VALUES ${values.join(',')}
    `);
  }

  await queryRunner.release();
  
  console.log('Seeding completed!');
  await app.close();
}

bootstrap();
