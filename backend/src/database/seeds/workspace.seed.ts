import { DataSource } from 'typeorm';
import { Workspace, WorkspaceType, WorkspaceAvailability } from '../../workspaces/workspace.entity';

export async function seedWorkspaces(dataSource: DataSource): Promise<Workspace[]> {
  const repo = dataSource.getRepository(Workspace);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(`  Workspaces: skipped (${existing} already exist)`);
    return repo.find();
  }

  const workspaces = await repo.save([
    repo.create({ name: 'Open Hot Desk', type: WorkspaceType.HOT_DESK, capacity: 20, pricePerHour: 5.00, availability: WorkspaceAvailability.AVAILABLE, description: 'Flexible open seating area', amenities: ['WiFi', 'Power outlets', 'Coffee'] }),
    repo.create({ name: 'Dedicated Desk A', type: WorkspaceType.DEDICATED_DESK, capacity: 1, pricePerHour: 10.00, availability: WorkspaceAvailability.AVAILABLE, description: 'Your own permanent desk', amenities: ['WiFi', 'Monitor', 'Locker'] }),
    repo.create({ name: 'Private Office 1', type: WorkspaceType.PRIVATE_OFFICE, capacity: 4, pricePerHour: 25.00, availability: WorkspaceAvailability.AVAILABLE, description: 'Enclosed private office for small teams', amenities: ['WiFi', 'Whiteboard', 'TV', 'Phone'] }),
    repo.create({ name: 'Boardroom', type: WorkspaceType.MEETING_ROOM, capacity: 12, pricePerHour: 40.00, availability: WorkspaceAvailability.AVAILABLE, description: 'Large meeting room with AV equipment', amenities: ['WiFi', 'Projector', 'Whiteboard', 'Video conferencing'] }),
  ]);

  console.log(`  Workspaces: created ${workspaces.length}`);
  return workspaces;
}
