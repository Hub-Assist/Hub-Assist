import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConfirmBooking } from "@/lib/react-query/hooks/bookings/useConfirmBooking";
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

describe("useConfirmBooking", () => {
  let mockConfirmBooking: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirmBooking = jest.fn();
    (apiClient.api as any) = {
      ...(apiClient.api as any),
      confirmBooking: mockConfirmBooking,
    };
  });

  describe("optimistic update", () => {
    it("sets booking status to confirmed before API call completes", async () => {
      const booking = makeBooking();
      let resolveConfirm!: (value: Booking) => void;
      mockConfirmBooking.mockReturnValueOnce(
        new Promise<Booking>((resolve) => { resolveConfirm = resolve; })
      );

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);
      queryClient.setQueryData(["bookings", "all"], [booking]);

      const { result } = renderHook(() => useConfirmBooking(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate(booking.id);
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));

      const optimisticBooking = queryClient.getQueryData<Booking>(["booking", booking.id]);
      expect(optimisticBooking?.status).toBe("confirmed");

      const optimisticList = queryClient.getQueryData<Booking[]>(["bookings", "all"]);
      expect(optimisticList?.[0].status).toBe("confirmed");

      resolveConfirm(makeBooking({ status: "confirmed" }));
    });

    it("registers mutation under the correct mutation key", async () => {
      mockConfirmBooking.mockReturnValueOnce(new Promise(() => {}));

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useConfirmBooking(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate("booking-1");
      });

      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation?.options.mutationKey).toEqual(["bookings", "confirm"]);
    });
  });

  describe("onError rollback", () => {
    it("restores booking to previous pending status on API failure", async () => {
      const booking = makeBooking();
      mockConfirmBooking.mockRejectedValueOnce(new Error("Server error"));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);
      queryClient.setQueryData(["bookings", "all"], [booking]);

      const { result } = renderHook(() => useConfirmBooking(), {
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

    it("restores all cached booking lists on error", async () => {
      const booking = makeBooking();
      mockConfirmBooking.mockRejectedValueOnce(new Error("Network error"));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["bookings", "all"], [booking]);
      queryClient.setQueryData(["bookings", "pending"], [booking]);

      const { result } = renderHook(() => useConfirmBooking(), {
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
      mockConfirmBooking.mockResolvedValueOnce(makeBooking({ status: "confirmed" }));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useConfirmBooking(), {
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
      mockConfirmBooking.mockRejectedValueOnce(new Error("Server error"));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["booking", booking.id], booking);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useConfirmBooking(), {
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
      const bookingB = makeBooking({ id: "b" });
      mockConfirmBooking.mockResolvedValue(makeBooking({ status: "confirmed" }));

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["bookings", "all"], [bookingA, bookingB]);

      const { result } = renderHook(() => useConfirmBooking(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate("a");
        result.current.mutate("b");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockConfirmBooking).toHaveBeenCalledTimes(2);
    });
  });
});
