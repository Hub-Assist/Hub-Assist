"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@zod/zod";
import { z } from "zod";
import { Camera, Save, Lock } from "lucide-react";
import { User } from "@/types/user";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

const profileSchema = z.object({
  firstname: z.string().min(1, "First name is required"),
  lastname: z.string().min(1, "Last name is required"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, token, updateUser } = useAuthStore();
  const { showToast } = useToast();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstname: user?.firstname || "",
      lastname: user?.lastname || "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const handleProfileSubmit = async (data: ProfileFormData) => {
    if (!token || !user) return;

    setIsUpdatingProfile(true);
    try {
      await api.updateUser(token, user.id, data);
      updateUser(data);
      showToast("success", "Profile updated successfully");
    } catch (error) {
      showToast("error", "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    if (!token) return;

    setIsChangingPassword(true);
    try {
      await api.changePassword(token, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      showToast("success", "Password changed successfully");
      passwordForm.reset();
    } catch (error) {
      showToast("error", "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleAvatarUpload = async () => {
    if (!token || !user || !selectedFile) return;

    try {
      const response = await api.uploadProfilePicture(token, user.id, selectedFile);
      updateUser({ avatar: response.avatarUrl });
      showToast("success", "Profile picture updated successfully");
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      showToast("error", "Failed to upload profile picture");
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Loading profile...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Profile Header */}
      <div className="flex items-center space-x-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {previewUrl || user.avatar ? (
              <img
                src={previewUrl || user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-gray-600">
                {user.name.charAt(0)}
              </span>
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90">
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
          <p className="text-sm text-muted-foreground capitalize">
            {user.role} • Member since {new Date(user.joinedDate).toLocaleDateString()}
          </p>
        </div>
        {selectedFile && (
          <Button onClick={handleAvatarUpload} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Photo
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Update Profile Form */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Personal Information</h2>
          <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">First Name</label>
              <Input
                {...profileForm.register("firstname")}
                placeholder="Enter your first name"
              />
              {profileForm.formState.errors.firstname && (
                <p className="text-sm text-red-600 mt-1">
                  {profileForm.formState.errors.firstname.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Last Name</label>
              <Input
                {...profileForm.register("lastname")}
                placeholder="Enter your last name"
              />
              {profileForm.formState.errors.lastname && (
                <p className="text-sm text-red-600 mt-1">
                  {profileForm.formState.errors.lastname.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={isUpdatingProfile}>
              {isUpdatingProfile ? "Updating..." : "Update Profile"}
            </Button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Lock className="h-5 w-5 mr-2" />
            Change Password
          </h2>
          <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Current Password</label>
              <Input
                type="password"
                {...passwordForm.register("currentPassword")}
                placeholder="Enter your current password"
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-red-600 mt-1">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">New Password</label>
              <Input
                type="password"
                {...passwordForm.register("newPassword")}
                placeholder="Enter your new password"
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-red-600 mt-1">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Confirm New Password</label>
              <Input
                type="password"
                {...passwordForm.register("confirmPassword")}
                placeholder="Confirm your new password"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600 mt-1">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}