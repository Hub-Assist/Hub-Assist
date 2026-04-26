export type WorkspaceType = "office" | "meeting-room" | "desk" | "conference-room";

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  capacity: number;
  pricePerHour: number;
  availability: boolean;
  description?: string;
  amenities?: string[];
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  workspaceId: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  workspace?: Workspace;
}

export interface BookingFormData {
  workspaceId: string;
  startTime: string;
  endTime: string;
}

export interface WorkspaceFilters {
  type?: WorkspaceType;
  availability?: boolean;
  minPrice?: number;
  maxPrice?: number;
}