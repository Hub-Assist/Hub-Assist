import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/user.entity';

export async function seedUsers(dataSource: DataSource): Promise<User[]> {
  const repo = dataSource.getRepository(User);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(`  Users: skipped (${existing} already exist)`);
    return repo.find();
  }

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  const users = await repo.save([
    repo.create({ firstName: 'Admin', lastName: 'User', email: 'admin@hubassist.dev', passwordHash: await hash('Admin@123'), role: UserRole.ADMIN, isVerified: true }),
    repo.create({ firstName: 'Alice', lastName: 'Johnson', email: 'alice@hubassist.dev', passwordHash: await hash('Member@123'), role: UserRole.MEMBER, isVerified: true }),
    repo.create({ firstName: 'Bob', lastName: 'Smith', email: 'bob@hubassist.dev', passwordHash: await hash('Member@123'), role: UserRole.MEMBER, isVerified: true }),
    repo.create({ firstName: 'Carol', lastName: 'White', email: 'carol@hubassist.dev', passwordHash: await hash('Member@123'), role: UserRole.MEMBER, isVerified: true }),
    repo.create({ firstName: 'David', lastName: 'Brown', email: 'david@hubassist.dev', passwordHash: await hash('Member@123'), role: UserRole.MEMBER, isVerified: true }),
    repo.create({ firstName: 'Eve', lastName: 'Davis', email: 'eve@hubassist.dev', passwordHash: await hash('Member@123'), role: UserRole.MEMBER, isVerified: true }),
    repo.create({ firstName: 'Frank', lastName: 'Miller', email: 'frank@hubassist.dev', passwordHash: await hash('Staff@123'), role: UserRole.STAFF, isVerified: true }),
    repo.create({ firstName: 'Grace', lastName: 'Wilson', email: 'grace@hubassist.dev', passwordHash: await hash('Staff@123'), role: UserRole.STAFF, isVerified: true }),
    repo.create({ firstName: 'Henry', lastName: 'Moore', email: 'henry@hubassist.dev', passwordHash: await hash('Staff@123'), role: UserRole.STAFF, isVerified: true }),
  ]);

  console.log(`  Users: created ${users.length}`);
  return users;
}
