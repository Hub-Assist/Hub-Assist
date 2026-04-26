export type UserRole = "admin" | "member" | "staff";

export interface User {
  id: string;
  avatar?: string;
  firstname: string;
  lastname: string;
  name: string; // computed from firstname + lastname
  email: string;
  role: UserRole;
  verified: boolean;
  active: boolean;
  joinedDate: string;
  stellarPublicKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdateData {
  firstname?: string;
  lastname?: string;
  stellarPublicKey?: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ProfilePictureUpload {
  file: File;
}

export interface NotificationSettings {
  emailNewBooking: boolean;
  emailBookingConfirmed: boolean;
  emailNewsletter: boolean;
}

export interface UserSettings extends NotificationSettings {
  theme: "light" | "dark" | "system";
}