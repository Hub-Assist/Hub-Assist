import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCancelBooking } from "@/lib/react-query/hooks/bookings/useCancelBooking";
import * as apiClient from "@/lib/apiClient";
import type { Booking } from "@/lib/apiClient";
import React from "react";

jest.mock("@/lib/apiClient");

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const makeBooking = (overrides?: Partial<Booking>): Booking => ({
  id: "booking-1",
  workspaceName: "Hot Desk A",
  date: "2026-07-01",
  startTime: "09:00",
  endTime: "17:00",
  amount: 50,
  status: "pending",
  ...overrides,
});

const createWrapper = (queryClient: QueryClient) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

describe("useCancelBooking", () => {
  let mockCancelBooking: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCancelBooking = jest.fn();
    (apiClient.api as any) = {
      ...(apiClient.api as any),
      cancelBooking: mockCancelBooking,
    };
  });

  describe("optimistic update", () => {
    it("sets booking status to cancelled before API call completes", async () => {
      const booking = makeBooking();
      let resolveCancel!: (value: Booking) => void;
      mockCancelBooking.mockReturnValueOnce(
        new Promise<Booking>((resolve) => { resolveCancel = resolve; })
      );

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);
      queryClient.setQueryData(["bookings", "all"], [booking]);

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate(booking.id);
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));

      const optimisticBooking = queryClient.getQueryData<Booking>(["booking", booking.id]);
      expect(optimisticBooking?.status).toBe("cancelled");

      const optimisticList = queryClient.getQueryData<Booking[]>(["bookings", "all"]);
      expect(optimisticList?.[0].status).toBe("cancelled");

      resolveCancel(makeBooking({ status: "cancelled" }));
    });

    it("registers mutation under the correct mutation key", async () => {
      mockCancelBooking.mockReturnValueOnce(new Promise(() => {}));

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate("booking-1");
      });

      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation?.options.mutationKey).toEqual(["bookings", "cancel"]);
    });

    it("applies optimistic update on a confirmed booking being cancelled", async () => {
      const booking = makeBooking({ status: "confirmed" });
      let resolveCancel!: (value: Booking) => void;
      mockCancelBooking.mockReturnValueOnce(
        new Promise<Booking>((resolve) => { resolveCancel = resolve; })
      );

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate(booking.id);
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));

      const optimisticBooking = queryClient.getQueryData<Booking>(["booking", booking.id]);
      expect(optimisticBooking?.status).toBe("cancelled");

      resolveCancel(makeBooking({ status: "cancelled" }));
    });
  });

  describe("onError rollback", () => {
    it("restores booking to previous pending status on API failure", async () => {
      const booking = makeBooking();
      mockCancelBooking.mockRejectedValueOnce(new Error("Server error"));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);
      queryClient.setQueryData(["bookings", "all"], [booking]);

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(booking.id);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const rolledBackBooking = queryClient.getQueryData<Booking>(["booking", booking.id]);
      expect(rolledBackBooking?.status).toBe("pending");

      const rolledBackList = queryClient.getQueryData<Booking[]>(["bookings", "all"]);
      expect(rolledBackList?.[0].status).toBe("pending");
    });

    it("restores a confirmed booking to confirmed on API failure", async () => {
      const booking = makeBooking({ status: "confirmed" });
      mockCancelBooking.mockRejectedValueOnce(new Error("Server error"));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(booking.id);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const rolledBackBooking = queryClient.getQueryData<Booking>(["booking", booking.id]);
      expect(rolledBackBooking?.status).toBe("confirmed");
    });

    it("restores all cached booking lists on error", async () => {
      const booking = makeBooking();
      mockCancelBooking.mockRejectedValueOnce(new Error("Network error"));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["bookings", "all"], [booking]);
      queryClient.setQueryData(["bookings", "pending"], [booking]);

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(booking.id);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(queryClient.getQueryData<Booking[]>(["bookings", "all"])?.[0].status).toBe("pending");
      expect(queryClient.getQueryData<Booking[]>(["bookings", "pending"])?.[0].status).toBe("pending");
    });
  });

  describe("onSettled", () => {
    it("invalidates bookings queries after successful mutation", async () => {
      const booking = makeBooking();
      mockCancelBooking.mockResolvedValueOnce(makeBooking({ status: "cancelled" }));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(booking.id);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bookings"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["booking", booking.id] });
    });

    it("invalidates bookings queries even after a failed mutation", async () => {
      const booking = makeBooking();
      mockCancelBooking.mockRejectedValueOnce(new Error("Server error"));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate(booking.id);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bookings"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["booking", booking.id] });
    });
  });

  describe("race conditions", () => {
    it("handles rapid successive mutations without corrupting the cache", async () => {
      const bookingA = makeBooking({ id: "a" });
      const bookingB = makeBooking({ id: "b", status: "confirmed" });
      mockCancelBooking.mockResolvedValue(makeBooking({ status: "cancelled" }));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["bookings", "all"], [bookingA, bookingB]);

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("a");
        result.current.mutate("b");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockCancelBooking).toHaveBeenCalledTimes(2);
    });
  });
});
