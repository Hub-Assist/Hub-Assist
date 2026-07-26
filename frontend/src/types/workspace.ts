export type WorkspaceType = "office" | "meeting-room" | "desk" | "conference-room";

/**
 * A single hourly availability slot returned by
 * GET /workspaces/:id/availability?date=YYYY-MM-DD
 */
export interface AvailabilitySlot {
  /** ISO 8601 timestamp for the start of this hour slot, e.g. "2026-07-28T08:00:00.000Z" */
  hour: string;
  /** Remaining seats available during this hour */
  available: number;
  /** Total capacity of the workspace */
  capacity: number;
}

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
  search?: string;
}