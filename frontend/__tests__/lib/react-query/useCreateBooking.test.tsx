import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateBooking } from "@/lib/react-query/hooks/bookings/useCreateBooking";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";
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

const createWrapper = (queryClient: QueryClient) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

const makeBooking = (overrides?: Partial<Booking>): Booking => ({
  id: "booking-1",
  workspaceName: "Hot Desk A",
  date: "2026-08-01",
  startTime: "2026-08-01T10:00",
  endTime: "2026-08-01T12:00",
  amount: 40,
  status: "pending",
  ...overrides,
});

describe("useCreateBooking", () => {
  let mockCreateBooking: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => useBookingWizardStore.getState().reset());
    mockCreateBooking = jest.fn();
    (apiClient.api as any) = {
      ...(apiClient.api as any),
      createBooking: mockCreateBooking,
    };
  });

  it("assembles the payload from wizard state and calls createBooking on completion", async () => {
    const timeSlot = { startTime: "2026-08-01T10:00", endTime: "2026-08-01T12:00" };
    act(() => {
      useBookingWizardStore.getState().setWorkspaceId("workspace-1");
      useBookingWizardStore.getState().nextStep();
      useBookingWizardStore.getState().setTimeSlot(timeSlot);
      useBookingWizardStore.getState().nextStep();
      useBookingWizardStore.getState().setPaymentDetails({ confirmed: true });
    });

    mockCreateBooking.mockResolvedValueOnce({ booking: makeBooking(), message: "created" });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(queryClient),
    });

    const state = useBookingWizardStore.getState();
    await act(async () => {
      await result.current.mutateAsync({
        workspaceId: state.workspaceId as string,
        startTime: state.timeSlot!.startTime,
        endTime: state.timeSlot!.endTime,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCreateBooking).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
    });
  });

  it("marks the wizard as complete with the returned booking id", async () => {
    const booking = makeBooking({ id: "booking-42" });
    mockCreateBooking.mockResolvedValueOnce({ booking, message: "created" });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      const response = await result.current.mutateAsync({
        workspaceId: "workspace-1",
        startTime: "2026-08-01T10:00",
        endTime: "2026-08-01T12:00",
      });
      useBookingWizardStore.getState().completeBooking(response.booking.id);
    });

    expect(useBookingWizardStore.getState().lastBookingId).toBe("booking-42");
    expect(useBookingWizardStore.getState().currentStep).toBe(4);
  });
});
