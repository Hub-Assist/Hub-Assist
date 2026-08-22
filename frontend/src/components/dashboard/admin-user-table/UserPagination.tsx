import { Button } from "@/components/ui/Button";
import type { UsersResponse } from "./types";

export interface UserPaginationProps {
  data: UsersResponse;
  currentPage: number;
  onPrev: () => void;
  onNext: () => void;
}

/** Page summary text + prev/next controls for the admin user table. */
export function UserPagination({ data, currentPage, onPrev, onNext }: UserPaginationProps) {
  if (data.totalPages <= 1) return null;

  return (
    <div className="flex justify-between items-center">
      <div className="text-sm text-muted-foreground">
        Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, data.total)} of {data.total} users
      </div>
      <div className="flex space-x-2">
        <Button variant="outline" onClick={onPrev} disabled={currentPage === 1}>
          Previous
        </Button>
        <Button variant="outline" onClick={onNext} disabled={currentPage === data.totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}
