import { Controller, Get, Post, Patch, Delete, UploadedFile, Param, Body, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './user.entity';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users (admin only, paginated)' })
  async findAll(@Query('skip') skip: number = 0, @Query('take') take: number = 10) {
    const [users, total] = await this.usersService.findAll(skip, take);
    return { users, total };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.usersService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post(':id/profile-picture')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload profile picture' })
  async uploadProfilePicture(
    @Param('id') id: string,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
  ) {
    const url = await this.cloudinaryService.uploadImage(file);
    return this.usersService.updateProfilePicture(id, url);
  }
}
