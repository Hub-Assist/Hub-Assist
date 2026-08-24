import type { User } from "@/types/user";

export interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}
