import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace, WorkspaceType, WorkspaceAvailability } from './workspace.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';

@Injectable()
export class WorkspacesService {
  constructor(@InjectRepository(Workspace) private repo: Repository<Workspace>) {}

  create(dto: CreateWorkspaceDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    type?: WorkspaceType,
    availability?: WorkspaceAvailability,
  ) {
    const query = this.repo.createQueryBuilder('workspace').where('workspace.deletedAt IS NULL');

    if (type) {
      query.andWhere('workspace.type = :type', { type });
    }

    if (availability) {
      query.andWhere('workspace.availability = :availability', { availability });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const workspace = await this.repo.findOne({
      where: { id, deletedAt: null },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  async update(id: string, dto: UpdateWorkspaceDto) {
    await this.findById(id);
    await this.repo.update(id, dto);
    return this.findById(id);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.repo.softDelete(id);
  }
}
