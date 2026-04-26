"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@zod/zod";
import { z } from "zod";
import { Bell, Palette, Wallet, AlertTriangle } from "lucide-react";
import { UserSettings } from "@/types/user";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";

const settingsSchema = z.object({
  stellarPublicKey: z.string().optional(),
});

const deleteSchema = z.object({
  confirmEmail: z.string().min(1, "Please enter your email"),
});

type SettingsFormData = z.infer<typeof settingsSchema>;
type DeleteFormData = z.infer<typeof deleteSchema>;

export default function SettingsPage() {
  const { user, token, updateUser, clear } = useAuthStore();
  const { showToast } = useToast();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [notifications, setNotifications] = useState({
    emailNewBooking: true,
    emailBookingConfirmed: true,
    emailNewsletter: false,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      stellarPublicKey: user?.stellarPublicKey || "",
    },
  });

  const deleteForm = useForm<DeleteFormData>({
    resolver: zodResolver(deleteSchema),
  });

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }

    // Load notification settings (in a real app, this would come from API)
    const savedNotifications = localStorage.getItem("notifications");
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
    }
  }, []);

  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    const root = document.documentElement;
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.toggle("dark", systemTheme === "dark");
    } else {
      root.classList.toggle("dark", newTheme === "dark");
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    const newNotifications = { ...notifications, [key]: !notifications[key] };
    setNotifications(newNotifications);
    localStorage.setItem("notifications", JSON.stringify(newNotifications));
  };

  const handleSettingsSubmit = async (data: SettingsFormData) => {
    if (!token || !user) return;

    setIsUpdatingSettings(true);
    try {
      await api.updateUser(token, user.id, { stellarPublicKey: data.stellarPublicKey });
      updateUser({ stellarPublicKey: data.stellarPublicKey });
      showToast("success", "Settings updated successfully");
    } catch (error) {
      showToast("error", "Failed to update settings");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleDeleteAccount = async (data: DeleteFormData) => {
    if (!token || !user) return;

    if (data.confirmEmail !== user.email) {
      deleteForm.setError("confirmEmail", { message: "Email does not match" });
      return;
    }

    setIsDeleting(true);
    try {
      // In a real app, you'd call an API to delete the account
      // For now, just clear local state
      clear();
      showToast("success", "Account deleted successfully");
      // Redirect to home or login
      window.location.href = "/";
    } catch (error) {
      showToast("error", "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Notification Preferences */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Bell className="h-5 w-5 mr-2" />
          Notification Preferences
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Email notifications for new bookings</label>
              <p className="text-sm text-muted-foreground">Receive emails when you make a new booking</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailNewBooking}
              onChange={() => handleNotificationChange("emailNewBooking")}
              className="rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Email notifications for confirmed bookings</label>
              <p className="text-sm text-muted-foreground">Receive emails when your bookings are confirmed</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailBookingConfirmed}
              onChange={() => handleNotificationChange("emailBookingConfirmed")}
              className="rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Newsletter</label>
              <p className="text-sm text-muted-foreground">Receive weekly newsletters with updates</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailNewsletter}
              onChange={() => handleNotificationChange("emailNewsletter")}
              className="rounded"
            />
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Palette className="h-5 w-5 mr-2" />
          Appearance
        </h2>
        <div className="space-y-2">
          <label className="text-sm font-medium">Theme</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="theme"
                value="light"
                checked={theme === "light"}
                onChange={(e) => handleThemeChange(e.target.value as "light")}
                className="mr-2"
              />
              Light
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={theme === "dark"}
                onChange={(e) => handleThemeChange(e.target.value as "dark")}
                className="mr-2"
              />
              Dark
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="theme"
                value="system"
                checked={theme === "system"}
                onChange={(e) => handleThemeChange(e.target.value as "system")}
                className="mr-2"
              />
              System
            </label>
          </div>
        </div>
      </div>

      {/* Stellar Wallet */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Wallet className="h-5 w-5 mr-2" />
          Stellar Wallet
        </h2>
        <form onSubmit={settingsForm.handleSubmit(handleSettingsSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Stellar Public Key</label>
            <Input
              {...settingsForm.register("stellarPublicKey")}
              placeholder="Enter your Stellar public key"
            />
            {settingsForm.formState.errors.stellarPublicKey && (
              <p className="text-sm text-red-600 mt-1">
                {settingsForm.formState.errors.stellarPublicKey.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={isUpdatingSettings}>
            {isUpdatingSettings ? "Updating..." : "Save Settings"}
          </Button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4 border-t pt-8">
        <h2 className="text-xl font-semibold text-red-600 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          Danger Zone
        </h2>
        <div className="border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800">Delete Account</h3>
          <p className="text-sm text-red-600 mt-2">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account and remove your data from our servers.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={deleteForm.handleSubmit(handleDeleteAccount)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Type your email ({user.email}) to confirm
              </label>
              <Input
                {...deleteForm.register("confirmEmail")}
                placeholder="Enter your email"
              />
              {deleteForm.formState.errors.confirmEmail && (
                <p className="text-sm text-red-600 mt-1">
                  {deleteForm.formState.errors.confirmEmail.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}