import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';
import { WorkspaceType, WorkspaceAvailability } from './workspace.entity';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private service: WorkspacesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateWorkspaceDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('type') type?: WorkspaceType,
    @Query('availability') availability?: WorkspaceAvailability,
  ) {
    return this.service.findAll(page, limit, type, availability);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string) {
    return this.service.softDelete(id);
  }
}
