import { Search } from "lucide-react";
import { UserRole } from "@/types/user";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface UserFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: UserRole | "";
  onRoleFilterChange: (value: UserRole | "") => void;
}

/** Search box + role dropdown for the admin user table. */
export function UserFilters({ search, onSearchChange, roleFilter, onRoleFilterChange }: UserFiltersProps) {
  return (
    <div className="flex gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <Select
        aria-label="Filter by role"
        value={roleFilter}
        onChange={(e) => onRoleFilterChange(e.target.value as UserRole | "")}
      >
        <option value="">All Roles</option>
        <option value="admin">Admin</option>
        <option value="member">Member</option>
        <option value="staff">Staff</option>
      </Select>
    </div>
  );
}
