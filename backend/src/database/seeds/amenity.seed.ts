import { DataSource } from 'typeorm';
import { Amenity } from '../../workspaces/amenity.entity';

export const seedAmenities = async (dataSource: DataSource) => {
  const repo = dataSource.getRepository(Amenity);

  const defaultAmenities = [
    { name: 'WiFi', icon: 'wifi', category: 'Connectivity' },
    { name: 'Standing Desk', icon: 'standing-desk', category: 'Furniture' },
    { name: 'Whiteboard', icon: 'whiteboard', category: 'Equipment' },
    { name: 'Coffee', icon: 'coffee', category: 'Refreshments' },
    { name: 'Printer', icon: 'printer', category: 'Equipment' },
    { name: 'Air Conditioning', icon: 'ac', category: 'Comfort' },
  ];

  for (const item of defaultAmenities) {
    const exists = await repo.findOne({ where: { name: item.name } });
    if (!exists) {
      await repo.save(repo.create(item));
    }
  }
};
