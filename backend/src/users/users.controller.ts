import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  UploadedFile,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CacheInterceptor, CacheKey, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './users.dto';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';

@ApiTags('users')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ version: '1', path: 'users' })
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userSearchService: UserSearchService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private userCacheKey(id: string) {
    return `user:${id}`;
  }
  @Get('search')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Full-text search users (admin only)',
    description: `Search across name and email with advanced filtering.

**Search behavior:**
- Uses PostgreSQL full-text search (tsvector GIN index)
- Supports partial matches and word boundaries
- Results ranked by relevance when searching

**Filters:**
- \`role\` – Filter by user role (admin, member, staff)
- \`verified\` – Filter by verification status (true/false)

**Pagination:**
- Cursor-based pagination using user ID
- Returns \`hasMore\` flag and \`nextCursor\` for pagination

**Email masking:**
- Non-admin users see masked email addresses (e.g., \`jo****@example.com\`)
- Admin users see full email addresses`,
  })
  @ApiQuery({ name: 'q', type: String, required: false, example: 'john' })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'verified', type: Boolean, required: false })
  @ApiQuery({ name: 'cursor', type: String, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              role: { type: 'string', enum: ['admin', 'member', 'staff'] },
              isVerified: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        hasMore: { type: 'boolean' },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  })
  async search(@Query() dto: UserSearchDto) {
    return this.userSearchService.search(dto);
  }

  @Get()

  @Post('change-password')
  @ApiOperation({ summary: 'Change own password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  changePassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.usersService.changePassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('user')
  @CacheTTL(600) // 10 minutes
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async update(@Param('id') id: string, @Body() data: UpdateUserDto) {
    const result = await this.usersService.update(id, data);
    await this.cacheManager.del(this.userCacheKey(id));
    return result;
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(AuditInterceptor)
  @Audit('user.role_updated')
  @ApiOperation({ summary: 'Update user role (admin only) — immediately revokes the user\'s current access token' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  async updateRole(@Param('id') id: string, @Body('role') role: UserRole, @Req() req: any) {
    req.auditBefore = await this.usersService.findById(id);
    const result = await this.usersService.update(id, { role });
    await this.cacheManager.del(this.userCacheKey(id));

    // Blacklist the admin's current access token on role-change events so that
    // any token issued before the role change is immediately invalidated.
    // This also covers the case where the admin changes their own role.
    if (req.user?.jti && req.user?.exp !== undefined) {
      const nowMs = Date.now();
      const remainingMs = req.user.exp * 1000 - nowMs;
      await this.tokenBlacklistService.blacklistToken(req.user.jti, remainingMs);
    }

    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async delete(@Param('id') id: string) {
    const result = await this.usersService.delete(id);
    await this.cacheManager.del(this.userCacheKey(id));
    return result;
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate user' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  activate(@Param('id') id: string) {
    return this.usersService.update(id, { isActive: true });
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  deactivate(@Param('id') id: string) {
    return this.usersService.update(id, { isActive: false });
  }

  @Post(':id/profile-picture')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Upload profile picture',
    description: `Uploads a profile picture and stores three resolution variants via Cloudinary transformations.

**Variants stored**
| Key | Dimensions | Use case |
|-----|-----------|----------|
| thumbnail | 50×50 | Comment avatars, notification icons |
| avatar | 200×200 | Profile headers, user cards |
| full | 800×800 | Profile detail pages |

The upload applies EXIF orientation correction and face-detection auto-crop.

**Backward compatibility**: The legacy \`profilePicture\` field continues to be populated with the \`avatar\` variant URL.`,
  })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Profile picture uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string' },
        profilePicture: {
          type: 'string',
          description: '(Deprecated) Avatar variant URL – kept for backward compatibility',
          example: 'https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill,g_face,q_auto,f_auto/hubassist/profile-pictures/abc123',
        },
        profilePictureUrls: {
          type: 'object',
          description: 'Multi-resolution variant URLs',
          properties: {
            thumbnail: {
              type: 'string',
              description: '50×50 thumbnail URL',
              example: 'https://res.cloudinary.com/demo/image/upload/w_50,h_50,c_fill,g_face,q_auto,f_auto/hubassist/profile-pictures/abc123',
            },
            avatar: {
              type: 'string',
              description: '200×200 avatar URL',
              example: 'https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill,g_face,q_auto,f_auto/hubassist/profile-pictures/abc123',
            },
            full: {
              type: 'string',
              description: '800×800 full-size URL',
              example: 'https://res.cloudinary.com/demo/image/upload/w_800,h_800,c_limit,g_auto,q_auto,f_auto/hubassist/profile-pictures/abc123',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async uploadProfilePicture(
    @Param('id') id: string,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
  ) {
    const urls = await this.cloudinaryService.uploadProfilePicture(file);
    const result = await this.usersService.updateProfilePicture(id, urls);
    await this.cacheManager.del(this.userCacheKey(id));
    return result;
  }
}
