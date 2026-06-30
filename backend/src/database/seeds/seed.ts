import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../../users/user.entity';
import { Workspace } from '../../workspaces/workspace.entity';
import { Amenity } from '../../workspaces/amenity.entity';
import { Booking } from '../../bookings/booking.entity';
import { NewsletterSubscriber } from '../../newsletter/newsletter-subscriber.entity';
import { ContactMessage } from '../../contact/contact-message.entity';
import { RefreshToken } from '../../auth/refresh-token.entity';
import { WebAuthnCredential } from '../../auth/webauthn-credential.entity';
import { Attendance } from '../../attendance/attendance.entity';
import { seedUsers } from './user.seed';
import { seedAmenities } from './amenity.seed';
import { seedWorkspaces } from './workspace.seed';
import { seedBookings } from './booking.seed';
import { v4 as uuidv4 } from 'uuid';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  entities: [User, Workspace, Amenity, Booking, NewsletterSubscriber, ContactMessage, RefreshToken, WebAuthnCredential, Attendance],
});

async function seedNewsletter(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(NewsletterSubscriber);
  const existing = await repo.count();
  if (existing > 0) {
    console.log(`  Newsletter subscribers: skipped (${existing} already exist)`);
    return;
  }

  const emails = [
    'newsletter1@example.com',
    'newsletter2@example.com',
    'newsletter3@example.com',
    'newsletter4@example.com',
    'newsletter5@example.com',
  ];

  await repo.save(
    emails.map((email, i) =>
      repo.create({
        email,
        confirmationToken: uuidv4(),
        unsubscribeToken: uuidv4(),
        isConfirmed: i < 3, // first 3 confirmed
      }),
    ),
  );
  console.log(`  Newsletter subscribers: created ${emails.length}`);
}

async function seedContact(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(ContactMessage);
  const existing = await repo.count();
  if (existing > 0) {
    console.log(`  Contact messages: skipped (${existing} already exist)`);
    return;
  }

  await repo.save([
    repo.create({ fullName: 'Jane Doe', email: 'jane@example.com', subject: 'Pricing inquiry', message: 'Hi, I would like to know more about your pricing plans.' }),
    repo.create({ fullName: 'John Smith', email: 'john@example.com', subject: 'Partnership opportunity', message: 'We are interested in partnering with HubAssist for our enterprise clients.' }),
    repo.create({ fullName: 'Sara Lee', email: 'sara@example.com', subject: 'Technical support', message: 'I am having trouble logging into my account. Please help.' }),
  ]);
  console.log('  Contact messages: created 3');
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  await dataSource.initialize();

  try {
    const users = await seedUsers(dataSource);
    await seedAmenities(dataSource);
    const workspaces = await seedWorkspaces(dataSource);
    await seedBookings(dataSource, users, workspaces);
    await seedNewsletter(dataSource);
    await seedContact(dataSource);

    console.log('\n✅ Seed complete.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
