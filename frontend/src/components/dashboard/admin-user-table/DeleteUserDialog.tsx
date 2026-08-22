import { User } from "@/types/user";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";

export interface DeleteUserDialogProps {
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: string) => void;
}

/** Confirmation dialog for deleting a user. */
export function DeleteUserDialog({ user, onClose, onConfirm }: DeleteUserDialogProps) {
  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {user?.name}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => user && onConfirm(user.id)}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
