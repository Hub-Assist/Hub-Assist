import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
} from 'typeorm';
import { Workspace } from './workspace.entity';

@Entity('amenities')
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  icon: string; // icon-name strings referencing a UI icon library

  @Column({ nullable: true })
  category: string;

  @ManyToMany(() => Workspace, (workspace) => workspace.amenities)
  workspaces: Workspace[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
