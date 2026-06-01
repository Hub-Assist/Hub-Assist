"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const bookings_service_1 = require("../src/bookings/bookings.service");
const booking_entity_1 = require("../src/bookings/booking.entity");
const workspace_entity_1 = require("../src/workspaces/workspace.entity");
const user_entity_1 = require("../src/users/user.entity");
const typeorm_1 = require("@nestjs/typeorm");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const args = process.argv.slice(2);
    let count = 100000;
    for (const arg of args) {
        if (arg.startsWith('--count=')) {
            count = parseInt(arg.split('=')[1], 10);
        }
    }
    const workspaceRepo = app.get((0, typeorm_1.getRepositoryToken)(workspace_entity_1.Workspace));
    const userRepo = app.get((0, typeorm_1.getRepositoryToken)(user_entity_1.User));
    const bookingsService = app.get(bookings_service_1.BookingsService);
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
    const bookingRepo = app.get((0, typeorm_1.getRepositoryToken)(booking_entity_1.BookingStatus));
    const queryRunner = workspaceRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    const batchSize = 5000;
    let values = [];
    const baseTime = new Date('2025-01-01T00:00:00Z').getTime();
    for (let i = 0; i < count; i++) {
        const start = new Date(baseTime + i * 3600000);
        const end = new Date(baseTime + i * 3600000 + 1800000);
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
//# sourceMappingURL=seed-bookings.js.map