import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from './hub.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { CreateHubDto } from './hubs.dto';

@Injectable()
export class HubsService {
  constructor(
    @InjectRepository(Hub) private hubRepo: Repository<Hub>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
  ) {}

  async create(ownerId: string, dto: CreateHubDto): Promise<Hub> {
    const existing = await this.hubRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Hub slug already in use');
    const hub = this.hubRepo.create({ ...dto, ownerId });
    return this.hubRepo.save(hub);
  }

  findAll(): Promise<Hub[]> {
    return this.hubRepo.find({ relations: ['owner'] });
  }

  async findBySlug(slug: string): Promise<Hub & { workspaces: Workspace[] }> {
    const hub = await this.hubRepo.findOne({ where: { slug }, relations: ['owner'] });
    if (!hub) throw new NotFoundException('Hub not found');
    const workspaces = await this.workspaceRepo.find({ where: { hubId: hub.id } });
    return { ...hub, workspaces };
  }
}
