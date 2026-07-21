"use client";

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CountDownTimer } from "@/components/ui/CountDownTimer";
import { useSessionTimeout } from "@/lib/hooks/useSessionTimeout";

/**
 * Renders the session-timeout warning modal.
 * Mount this once inside AuthInitializer so it's active for the whole app.
 */
export function SessionTimeoutDialog() {
  const { showWarning, countdownSeconds, onStayLoggedIn, onLogOut } = useSessionTimeout();

  // When the countdown hits zero, auto-logout
  const handleExpire = useCallback(() => {
    onLogOut();
  }, [onLogOut]);

  return (
    <Dialog
      open={showWarning}
      // Prevent accidental dismissal via backdrop click — user must choose an action
      onOpenChange={() => undefined}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your session is about to expire</DialogTitle>
        </DialogHeader>

        <DialogDescription>
          You will be automatically logged out in{" "}
          <CountDownTimer seconds={countdownSeconds} onExpire={handleExpire} />.
          {" "}Do you want to stay logged in?
        </DialogDescription>

        <DialogFooter>
          <Button variant="outline" onClick={onLogOut}>
            Log Out
          </Button>
          <Button variant="primary" onClick={onStayLoggedIn}>
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
