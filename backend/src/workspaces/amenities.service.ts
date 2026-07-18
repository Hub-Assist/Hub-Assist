import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Amenity } from './amenity.entity';
import { CreateAmenityDto } from './amenity.dto';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectRepository(Amenity)
    private readonly repo: Repository<Amenity>,
  ) {}

  async findAll(): Promise<Amenity[]> {
    return this.repo.find();
  }

  async create(dto: CreateAmenityDto): Promise<Amenity> {
    const amenity = this.repo.create(dto);
    return this.repo.save(amenity);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Amenity with ID ${id} not found`);
    }
  }

  async findByIds(ids: string[]): Promise<Amenity[]> {
    return this.repo.findByIds(ids);
  }
}
