"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Save, Lock, AlertCircle } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import { useUpdateProfile, type UpdateProfilePayload } from "@/hooks/useUpdateProfile";
import { profileSchema, type ProfileFormValues } from "@/lib/schemas/profileSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";



export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const { showToast } = useToast();
  const updateProfileMutation = useUpdateProfile();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const savedValuesRef = useRef<ProfileFormValues>({
    firstname: user?.firstname || "",
    lastname: user?.lastname || "",
    stellarPublicKey: user?.stellarPublicKey || "",
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: savedValuesRef.current,
  });

  const passwordForm = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>({
    resolver: zodResolver(
      z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(6, "New password must be at least 6 characters"),
        confirmPassword: z.string().min(1, "Please confirm your new password"),
      }).refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
      }),
    ),
  });

  const isDirty = profileForm.formState.isDirty;

  const handleProfileSubmit = () => {
    const { firstname, lastname } = profileForm.getValues();
    const payload: UpdateProfilePayload = {};

    if (firstname !== savedValuesRef.current.firstname) payload.firstname = firstname;
    if (lastname !== savedValuesRef.current.lastname) payload.lastname = lastname;

    if (Object.keys(payload).length === 0) {
      showToast("error", "No changes to save");
      return;
    }

    updateProfileMutation.mutate(payload, {
      onSuccess: () => {
        const updated: ProfileFormValues = {
          firstname: payload.firstname ?? savedValuesRef.current.firstname,
          lastname: payload.lastname ?? savedValuesRef.current.lastname,
          stellarPublicKey: savedValuesRef.current.stellarPublicKey,
        };
        savedValuesRef.current = updated;
        profileForm.reset(updated);
        updateUser(updated);
      },
      onError: () => {
        profileForm.reset(savedValuesRef.current);
      },
    });
  };

  const handlePasswordSubmit = async (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    setIsChangingPassword(true);
    try {
      await api.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      showToast("success", "Password changed successfully");
      passwordForm.reset();
    } catch {
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
    if (!user || !selectedFile) return;

    try {
      const response = await api.uploadProfilePicture(user.id, selectedFile);
      const updatedUser = { ...user, avatar: response.avatarUrl };
      updateUser(updatedUser);
      savedValuesRef.current = { ...savedValuesRef.current, ...updatedUser };
      showToast("success", "Profile picture updated successfully");
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch {
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
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Personal Information</h2>
            {isDirty && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <AlertCircle className="h-3 w-3" />
                Unsaved changes
              </span>
            )}
          </div>
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
            <Button type="submit" disabled={!isDirty || updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
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