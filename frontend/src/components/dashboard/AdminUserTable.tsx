"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, UserRole } from "@/types/user";
import { api } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import { UserFilters } from "./admin-user-table/UserFilters";
import { UserTable } from "./admin-user-table/UserTable";
import { UserPagination } from "./admin-user-table/UserPagination";
import { EditUserRoleDialog } from "./admin-user-table/EditUserRoleDialog";
import { DeleteUserDialog } from "./admin-user-table/DeleteUserDialog";
import type { UsersResponse } from "./admin-user-table/types";

export function AdminUserTable() {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const { data, isLoading, isError } = useQuery<UsersResponse>({
    queryKey: ["users", currentPage, search, roleFilter],
    queryFn: () => api.getUsers({ page: currentPage, limit: 10, search: search || undefined, role: roleFilter || undefined }),
    enabled: !!token,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => api.updateUserRole(userId, role),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousData = queryClient.getQueryData<UsersResponse>(["users", currentPage, search, roleFilter]);

      queryClient.setQueryData<UsersResponse>(["users", currentPage, search, roleFilter], (old) => {
        if (!old) return old;
        return {
          ...old,
          users: old.users.map(user =>
            user.id === userId ? { ...user, role } : user
          ),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["users", currentPage, search, roleFilter], context.previousData);
      }
      showToast("error", "Failed to update user role");
    },
    onSuccess: () => {
      showToast("success", "User role updated successfully");
      setEditingUser(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      active ? api.activateUser(userId) : api.deactivateUser(userId),
    onMutate: async ({ userId, active }) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousData = queryClient.getQueryData<UsersResponse>(["users", currentPage, search, roleFilter]);

      queryClient.setQueryData<UsersResponse>(["users", currentPage, search, roleFilter], (old) => {
        if (!old) return old;
        return {
          ...old,
          users: old.users.map(user =>
            user.id === userId ? { ...user, active } : user
          ),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["users", currentPage, search, roleFilter], context.previousData);
      }
      showToast("error", "Failed to update user status");
    },
    onSuccess: (_, { active }) => {
      showToast("success", `User ${active ? "activated" : "deactivated"} successfully`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast("success", "User deleted successfully");
      setDeleteUser(null);
    },
    onError: () => {
      showToast("error", "Failed to delete user");
    },
  });

  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    return data.users;
  }, [data?.users]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="h-10 bg-[#EDE2D6] rounded-md flex-1 animate-pulse" />
          <div className="h-10 w-32 bg-[#EDE2D6] rounded-md animate-pulse" />
        </div>
        <div className="h-96 bg-[#EDE2D6] rounded-lg animate-pulse mt-4" />
      </div>
    );
  }

  if (isError) {
    throw new Error("Failed to load users table.");
  }

  return (
    <div className="space-y-4">
      <UserFilters
        search={search}
        onSearchChange={setSearch}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
      />

      <UserTable
        users={filteredUsers}
        onEdit={setEditingUser}
        onToggleActive={(user) => toggleActiveMutation.mutate({ userId: user.id, active: !user.active })}
        onDelete={setDeleteUser}
      />

      {data && (
        <UserPagination
          data={data}
          currentPage={currentPage}
          onPrev={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setCurrentPage((prev) => Math.min(data.totalPages, prev + 1))}
        />
      )}

      <EditUserRoleDialog
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onChangeRole={(userId, role) => updateRoleMutation.mutate({ userId, role })}
      />

      <DeleteUserDialog
        user={deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={(userId) => deleteMutation.mutate(userId)}
      />
    </div>
  );
}
