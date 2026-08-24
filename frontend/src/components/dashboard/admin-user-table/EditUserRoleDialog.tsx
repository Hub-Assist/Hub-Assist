import { User, UserRole } from "@/types/user";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";

export interface EditUserRoleDialogProps {
  user: User | null;
  onClose: () => void;
  onChangeRole: (userId: string, role: UserRole) => void;
}

/** Dialog for changing a user's role. */
export function EditUserRoleDialog({ user, onClose, onChangeRole }: EditUserRoleDialogProps) {
  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User Role</DialogTitle>
          <DialogDescription>Change the role for {user?.name}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select
            aria-label="Select new role"
            value={user?.role || ""}
            onChange={(e) => {
              if (user) {
                onChangeRole(user.id, e.target.value as UserRole);
              }
            }}
          >
            <option value="member">Member</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
