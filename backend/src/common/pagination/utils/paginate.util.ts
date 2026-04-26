import { Repository, ObjectLiteral } from 'typeorm';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedResponse } from '../interface/paginated-response.interface';

export async function paginate<T extends ObjectLiteral>(
  query: PaginationQueryDto,
  repository: Repository<T>,
  options?: { where?: any; order?: any },
): Promise<PaginatedResponse<T>> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;

  const [data, total] = await repository.findAndCount({
    skip,
    take: limit,
    ...options,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
  };
}
