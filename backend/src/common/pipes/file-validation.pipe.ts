import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5 MB limit');
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only image files are allowed');
    }

    return file;
  }
}
