import { Controller, Get, Post, UseGuards, UploadedFile, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post(':id/profile-picture')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfilePicture(
    @Param('id') id: string,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
  ) {
    const url = await this.cloudinaryService.uploadImage(file);
    return this.usersService.updateProfilePicture(id, url);
  }
}
