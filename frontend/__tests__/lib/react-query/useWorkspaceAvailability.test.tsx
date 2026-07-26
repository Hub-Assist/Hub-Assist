/**
 * Unit tests for useWorkspaceAvailability React Query hook.
 *
 * Covers:
 * - Returns data when API call succeeds
 * - Exposes isError when the API call fails
 * - Does NOT fire when workspaceId is empty
 * - Does NOT fire when date is empty
 * - Uses the correct query key
 * - Calls the API with the correct arguments
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useWorkspaceAvailability } from "@/lib/react-query/hooks/workspaces/useWorkspaceAvailability";
import * as apiClient from "@/lib/apiClient";
import { createWrapper } from "./test-utils";
import type { AvailabilitySlot } from "@/types/workspace";

jest.mock("@/lib/apiClient");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal 24-slot availability array */
function makeSlots(capacity = 4, available = 4): AvailabilitySlot[] {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `2026-07-28T${String(h).padStart(2, "0")}:00:00.000Z`,
    available,
    capacity,
  }));
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let mockGetWorkspaceAvailability: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetWorkspaceAvailability = jest.fn();
  (apiClient.api as any) = {
    ...(apiClient.api as any),
    getWorkspaceAvailability: mockGetWorkspaceAvailability,
  };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useWorkspaceAvailability", () => {
  it("returns data when the API call succeeds", async () => {
    const slots = makeSlots();
    mockGetWorkspaceAvailability.mockResolvedValueOnce(slots);

    const { result } = renderHook(
      () => useWorkspaceAvailability("ws-1", "2026-07-28"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(slots);
  });

  it("calls the API with the correct workspaceId and date", async () => {
    mockGetWorkspaceAvailability.mockResolvedValueOnce([]);

    const { result } = renderHook(
      () => useWorkspaceAvailability("ws-abc", "2026-08-01"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetWorkspaceAvailability).toHaveBeenCalledWith("ws-abc", "2026-08-01");
  });

  it("exposes isError when the API call fails", async () => {
    mockGetWorkspaceAvailability.mockRejectedValueOnce(new Error("Server error"));

    const { result } = renderHook(
      () => useWorkspaceAvailability("ws-1", "2026-07-28"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does NOT call the API when workspaceId is empty", async () => {
    mockGetWorkspaceAvailability.mockResolvedValue([]);

    const { result } = renderHook(
      () => useWorkspaceAvailability("", "2026-07-28"),
      { wrapper: createWrapper() }
    );

    // The query should remain in a pending/idle state
    await new Promise((r) => setTimeout(r, 100));
    expect(mockGetWorkspaceAvailability).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false); // idle, not loading
    expect(result.current.data).toBeUndefined();
  });

  it("does NOT call the API when date is empty", async () => {
    mockGetWorkspaceAvailability.mockResolvedValue([]);

    const { result } = renderHook(
      () => useWorkspaceAvailability("ws-1", ""),
      { wrapper: createWrapper() }
    );

    await new Promise((r) => setTimeout(r, 100));
    expect(mockGetWorkspaceAvailability).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("uses different query keys for different dates (cache isolation)", () => {
    mockGetWorkspaceAvailability
      .mockResolvedValueOnce(makeSlots(4, 4))
      .mockResolvedValueOnce(makeSlots(4, 0));

    const wrapper = createWrapper();

    const { result: r1 } = renderHook(
      () => useWorkspaceAvailability("ws-1", "2026-07-28"),
      { wrapper }
    );
    const { result: r2 } = renderHook(
      () => useWorkspaceAvailability("ws-1", "2026-07-29"),
      { wrapper }
    );

    // Both hooks fire independently for different dates
    expect(mockGetWorkspaceAvailability).toHaveBeenCalledWith("ws-1", "2026-07-28");
    expect(mockGetWorkspaceAvailability).toHaveBeenCalledWith("ws-1", "2026-07-29");
    expect(mockGetWorkspaceAvailability).toHaveBeenCalledTimes(2);

    void r1;
    void r2;
  });

  it("uses different query keys for different workspaceIds (cache isolation)", () => {
    mockGetWorkspaceAvailability
      .mockResolvedValueOnce(makeSlots(4, 4))
      .mockResolvedValueOnce(makeSlots(2, 1));

    const wrapper = createWrapper();

    const { result: r1 } = renderHook(
      () => useWorkspaceAvailability("ws-1", "2026-07-28"),
      { wrapper }
    );
    const { result: r2 } = renderHook(
      () => useWorkspaceAvailability("ws-2", "2026-07-28"),
      { wrapper }
    );

    expect(mockGetWorkspaceAvailability).toHaveBeenCalledWith("ws-1", "2026-07-28");
    expect(mockGetWorkspaceAvailability).toHaveBeenCalledWith("ws-2", "2026-07-28");
    expect(mockGetWorkspaceAvailability).toHaveBeenCalledTimes(2);

    void r1;
    void r2;
  });

  it("returns an array of AvailabilitySlot objects with the correct shape", async () => {
    const slots = makeSlots(10, 7);
    mockGetWorkspaceAvailability.mockResolvedValueOnce(slots);

    const { result } = renderHook(
      () => useWorkspaceAvailability("ws-1", "2026-07-28"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data ?? [];
    expect(data).toHaveLength(24);
    data.forEach((slot) => {
      expect(slot).toHaveProperty("hour");
      expect(slot).toHaveProperty("available");
      expect(slot).toHaveProperty("capacity");
      expect(typeof slot.hour).toBe("string");
      expect(typeof slot.available).toBe("number");
      expect(typeof slot.capacity).toBe("number");
    });
  });
});
