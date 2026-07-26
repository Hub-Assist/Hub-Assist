/**
 * Unit tests for WorkspaceCalendar component
 *
 * Covers:
 * - Loading skeleton while data is fetching
 * - Error state
 * - Fully-booked workspace → all slot buttons disabled
 * - Fully-available workspace → at least some slot buttons enabled
 * - Clicking an available slot calls onSlotSelect with correct times
 * - Booked slots cannot trigger onSlotSelect
 * - Week navigation (prev/next/current week)
 * - Time-zone conversion: UTC slot times rendered via Intl.DateTimeFormat
 * - Skeleton component renders correctly
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceCalendar } from "@/components/workspaces/WorkspaceCalendar";
import { WorkspaceCalendarSkeleton } from "@/components/workspaces/WorkspaceCalendarSkeleton";
import * as apiClient from "@/lib/apiClient";
import type { AvailabilitySlot } from "@/types/workspace";
import type { SlotSelection } from "@/components/workspaces/WorkspaceCalendar";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/apiClient");

jest.mock("lucide-react", () => ({
  ChevronLeft: (props: React.SVGProps<SVGElement>) => <svg data-testid="icon-prev" />,
  ChevronRight: (props: React.SVGProps<SVGElement>) => <svg data-testid="icon-next" />,
}));

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

function Wrapper({ children }: { children: React.ReactNode }) {
  const qcRef = React.useRef<QueryClient | null>(null);
  if (!qcRef.current) qcRef.current = makeQueryClient();
  return (
    <QueryClientProvider client={qcRef.current}>{children}</QueryClientProvider>
  );
}

function renderCalendar(props: Partial<React.ComponentProps<typeof WorkspaceCalendar>> = {}) {
  return render(
    <WorkspaceCalendar workspaceId="ws-1" {...props} />,
    { wrapper: Wrapper }
  );
}

/**
 * Builds a 24-slot availability array.
 * Hours in `bookedHours` (UTC) have available=0; all others have `availableSeats`.
 */
function makeSlots(
  dateStr: string,
  capacity = 4,
  bookedHours: number[] = [],
  availableSeats = capacity
): AvailabilitySlot[] {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${dateStr}T${String(h).padStart(2, "0")}:00:00.000Z`,
    available: bookedHours.includes(h) ? 0 : availableSeats,
    capacity,
  }));
}

/** Today as YYYY-MM-DD in local time — same as what the component passes to the API */
function todayLocalDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Helper: wait for the calendar grid to appear */
async function waitForCalendar() {
  await waitFor(() => {
    expect(screen.getByTestId("workspace-calendar")).toBeInTheDocument();
  });
}

/** All slot buttons (data-testid="calendar-slot") */
function getSlotButtons(): HTMLElement[] {
  return screen.queryAllByTestId("calendar-slot");
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

// ─── WorkspaceCalendarSkeleton ────────────────────────────────────────────────

describe("WorkspaceCalendarSkeleton", () => {
  it("renders with aria-hidden and correct testid", () => {
    const { container } = render(<WorkspaceCalendarSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-testid", "workspace-calendar-skeleton");
  });

  it("does not contain any interactive buttons", () => {
    render(<WorkspaceCalendarSkeleton />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

// ─── WorkspaceCalendar ────────────────────────────────────────────────────────

describe("WorkspaceCalendar", () => {
  // ── Loading ────────────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows the skeleton while data is loading", () => {
      mockGetWorkspaceAvailability.mockReturnValue(new Promise(() => {}));
      renderCalendar();
      expect(screen.getByTestId("workspace-calendar-skeleton")).toBeInTheDocument();
      expect(screen.queryByTestId("workspace-calendar")).not.toBeInTheDocument();
    });
  });

  // ── Error ──────────────────────────────────────────────────────────────────

  describe("error state", () => {
    it("shows an error alert when any day query fails", async () => {
      mockGetWorkspaceAvailability.mockRejectedValue(new Error("Network error"));
      renderCalendar();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
      expect(screen.getByRole("alert")).toHaveTextContent(/failed to load availability/i);
    });
  });

  // ── Fully-booked workspace ─────────────────────────────────────────────────

  describe("fully-booked workspace", () => {
    it("renders all slot buttons as disabled", async () => {
      const today = todayLocalDateStr();
      const allHours = Array.from({ length: 24 }, (_, h) => h);
      mockGetWorkspaceAvailability.mockResolvedValue(makeSlots(today, 4, allHours));

      renderCalendar();
      await waitForCalendar();

      const slotBtns = getSlotButtons();
      expect(slotBtns.length).toBeGreaterThan(0);
      slotBtns.forEach((btn) => expect(btn).toBeDisabled());
    });

    it("every slot button's accessible name mentions 'fully booked'", async () => {
      const today = todayLocalDateStr();
      const allHours = Array.from({ length: 24 }, (_, h) => h);
      mockGetWorkspaceAvailability.mockResolvedValue(makeSlots(today, 4, allHours));

      renderCalendar();
      await waitForCalendar();

      const slotBtns = getSlotButtons();
      expect(slotBtns.length).toBeGreaterThan(0);
      slotBtns.forEach((btn) => {
        expect(btn.getAttribute("aria-label") ?? "").toMatch(/fully booked/i);
      });
    });
  });

  // ── Available workspace ────────────────────────────────────────────────────

  describe("available workspace", () => {
    it("renders enabled slot buttons for operating hours (08:00–19:00)", async () => {
      const today = todayLocalDateStr();
      mockGetWorkspaceAvailability.mockResolvedValue(makeSlots(today, 4, []));

      renderCalendar();
      await waitForCalendar();

      const enabledSlots = getSlotButtons().filter((btn) => !btn.hasAttribute("disabled"));
      // 12 operating hours × 7 days = 84 enabled slots max
      expect(enabledSlots.length).toBeGreaterThan(0);
    });
  });

  // ── Slot click → onSlotSelect ──────────────────────────────────────────────

  describe("slot click → onSlotSelect callback", () => {
    it("calls onSlotSelect with startTime, endTime (1 hour apart) and slot when an available slot is clicked", async () => {
      const today = todayLocalDateStr();
      // Only hour 10 UTC is available
      const booked = [0,1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,22,23];
      mockGetWorkspaceAvailability.mockResolvedValue(makeSlots(today, 4, booked));

      const onSlotSelect = jest.fn();
      renderCalendar({ onSlotSelect });
      await waitForCalendar();

      const enabledSlots = getSlotButtons().filter((btn) => !btn.hasAttribute("disabled"));
      expect(enabledSlots.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        fireEvent.click(enabledSlots[0]);
      });

      expect(onSlotSelect).toHaveBeenCalledTimes(1);

      const sel: SlotSelection = onSlotSelect.mock.calls[0][0];
      // startTime must be a datetime-local string
      expect(sel.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      // endTime is exactly 1 hour later
      const diff = new Date(sel.endTime).getTime() - new Date(sel.startTime).getTime();
      expect(diff).toBe(60 * 60 * 1000);
      // Slot object is passed through
      expect(sel.slot).toMatchObject({ available: 4, capacity: 4 });
    });

    it("does NOT call onSlotSelect when a disabled (booked) slot is clicked", async () => {
      const today = todayLocalDateStr();
      const allHours = Array.from({ length: 24 }, (_, h) => h);
      mockGetWorkspaceAvailability.mockResolvedValue(makeSlots(today, 4, allHours));

      const onSlotSelect = jest.fn();
      renderCalendar({ onSlotSelect });
      await waitForCalendar();

      const disabledSlots = getSlotButtons().filter((btn) => btn.hasAttribute("disabled"));
      expect(disabledSlots.length).toBeGreaterThan(0);

      fireEvent.click(disabledSlots[0]);
      expect(onSlotSelect).not.toHaveBeenCalled();
    });
  });

  // ── Week navigation ────────────────────────────────────────────────────────

  describe("week navigation", () => {
    beforeEach(() => {
      mockGetWorkspaceAvailability.mockResolvedValue([]);
    });

    it("renders previous-week and next-week nav buttons", async () => {
      renderCalendar();
      await waitForCalendar();

      expect(screen.getByLabelText("Previous week")).toBeInTheDocument();
      expect(screen.getByLabelText("Next week")).toBeInTheDocument();
    });

    it("advances the week label when next-week is clicked", async () => {
      renderCalendar();
      await waitForCalendar();

      const weekBtn = screen.getByTestId("week-range-btn");
      const initialLabel = weekBtn.textContent;

      fireEvent.click(screen.getByLabelText("Next week"));

      await waitFor(() => {
        expect(screen.getByTestId("week-range-btn").textContent).not.toBe(initialLabel);
      });
    });

    it("goes back the week label when previous-week is clicked", async () => {
      renderCalendar();
      await waitForCalendar();

      const weekBtn = screen.getByTestId("week-range-btn");
      const initialLabel = weekBtn.textContent;

      fireEvent.click(screen.getByLabelText("Previous week"));

      await waitFor(() => {
        expect(screen.getByTestId("week-range-btn").textContent).not.toBe(initialLabel);
      });
    });

    it("returns to the current week when the week-range button is clicked", async () => {
      renderCalendar();
      await waitForCalendar();

      const weekBtn = screen.getByTestId("week-range-btn");
      const initialLabel = weekBtn.textContent;

      fireEvent.click(screen.getByLabelText("Next week"));
      await waitFor(() => {
        expect(screen.getByTestId("week-range-btn").textContent).not.toBe(initialLabel);
      });

      fireEvent.click(screen.getByTestId("week-range-btn"));
      await waitFor(() => {
        expect(screen.getByTestId("week-range-btn").textContent).toBe(initialLabel);
      });
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe("accessibility", () => {
    beforeEach(() => {
      mockGetWorkspaceAvailability.mockResolvedValue([]);
    });

    it("renders a landmark region labelled by the Availability heading", async () => {
      renderCalendar();
      await waitForCalendar();

      const region = screen.getByRole("region");
      expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent(
        /availability/i
      );
    });

    it("renders the slot grid with role=grid", async () => {
      renderCalendar();
      await waitForCalendar();
      expect(screen.getByRole("grid")).toBeInTheDocument();
    });

    it("available slot buttons each have a descriptive aria-label mentioning 'seats available'", async () => {
      const today = todayLocalDateStr();
      mockGetWorkspaceAvailability.mockResolvedValue(makeSlots(today, 4, []));

      renderCalendar();
      await waitForCalendar();

      const enabledSlots = getSlotButtons().filter((btn) => !btn.hasAttribute("disabled"));
      expect(enabledSlots.length).toBeGreaterThan(0);
      enabledSlots.forEach((btn) => {
        expect(btn.getAttribute("aria-label") ?? "").toMatch(/seats available/i);
      });
    });
  });

  // ── Timezone conversion ────────────────────────────────────────────────────

  describe("timezone conversion", () => {
    it("maps UTC slot timestamps to local time for aria-labels", async () => {
      const today = todayLocalDateStr();
      mockGetWorkspaceAvailability.mockResolvedValue(makeSlots(today, 4, []));

      renderCalendar();
      await waitForCalendar();

      // JSDOM runs in UTC so UTC 10:00 → local 10:00 AM
      const expectedTime = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(`${today}T10:00:00.000Z`));

      const slotBtns = getSlotButtons();
      const matchingBtn = slotBtns.find((btn) =>
        (btn.getAttribute("aria-label") ?? "").includes(expectedTime)
      );
      expect(matchingBtn).toBeDefined();
    });

    it("passes YYYY-MM-DD date strings to the availability API", async () => {
      mockGetWorkspaceAvailability.mockResolvedValue([]);

      renderCalendar();

      await waitFor(() => {
        expect(mockGetWorkspaceAvailability).toHaveBeenCalled();
      });

      mockGetWorkspaceAvailability.mock.calls.forEach(([_id, dateArg]) => {
        expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  // ── Legend ─────────────────────────────────────────────────────────────────

  describe("legend", () => {
    it("renders colour-coded legend entries", async () => {
      mockGetWorkspaceAvailability.mockResolvedValue([]);

      renderCalendar();
      await waitForCalendar();

      expect(screen.getByText(/available/i)).toBeInTheDocument();
      expect(screen.getByText(/fully booked/i)).toBeInTheDocument();
      expect(screen.getByText(/outside operating hours/i)).toBeInTheDocument();
    });
  });
});
