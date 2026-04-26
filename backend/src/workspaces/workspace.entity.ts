import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum WorkspaceType {
  HOT_DESK = 'HotDesk',
  DEDICATED_DESK = 'DedicatedDesk',
  PRIVATE_OFFICE = 'PrivateOffice',
  MEETING_ROOM = 'MeetingRoom',
  VIRTUAL = 'Virtual',
  HYBRID = 'Hybrid',
}

export enum WorkspaceAvailability {
  AVAILABLE = 'Available',
  UNAVAILABLE = 'Unavailable',
}

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: WorkspaceType })
  type: WorkspaceType;

  @Column()
  capacity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerHour: number;

  @Column({ type: 'enum', enum: WorkspaceAvailability })
  availability: WorkspaceAvailability;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  amenities: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
