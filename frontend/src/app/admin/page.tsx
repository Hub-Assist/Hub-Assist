import type { Metadata } from "next";
import { AdminUserTable } from "@/components/dashboard/AdminUserTable";

export const metadata: Metadata = {
  title: "Admin · User Management",
  description: "Search, filter, and manage member accounts, roles, and status.",
};

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">User Management</h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          Search members, update roles, and manage account status.
        </p>
      </div>
      <AdminUserTable />
    </div>
  );
}
