import { act } from "@testing-library/react";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";

beforeEach(() => {
  act(() => useBookingWizardStore.getState().reset());
});

describe("bookingWizardStore", () => {
  describe("Step 1 -> Step 2 transition", () => {
    it("blocks advancing without a workspaceId", () => {
      let advanced = true;
      act(() => { advanced = useBookingWizardStore.getState().nextStep(); });
      expect(advanced).toBe(false);
      expect(useBookingWizardStore.getState().currentStep).toBe(1);
    });

    it("advances once workspaceId is set", () => {
      act(() => useBookingWizardStore.getState().setWorkspaceId("workspace-1"));
      let advanced = false;
      act(() => { advanced = useBookingWizardStore.getState().nextStep(); });
      expect(advanced).toBe(true);
      expect(useBookingWizardStore.getState().currentStep).toBe(2);
    });
  });

  describe("Step 2 time slot validation", () => {
    beforeEach(() => {
      act(() => useBookingWizardStore.getState().setWorkspaceId("workspace-1"));
      act(() => useBookingWizardStore.getState().nextStep());
    });

    it("blocks advancing when end time is before start time", () => {
      act(() =>
        useBookingWizardStore.getState().setTimeSlot({
          startTime: "2026-08-01T12:00",
          endTime: "2026-08-01T10:00",
        })
      );
      let advanced = true;
      act(() => { advanced = useBookingWizardStore.getState().nextStep(); });
      expect(advanced).toBe(false);
      expect(useBookingWizardStore.getState().currentStep).toBe(2);
    });

    it("advances when the time range is valid", () => {
      act(() =>
        useBookingWizardStore.getState().setTimeSlot({
          startTime: "2026-08-01T10:00",
          endTime: "2026-08-01T12:00",
        })
      );
      let advanced = false;
      act(() => { advanced = useBookingWizardStore.getState().nextStep(); });
      expect(advanced).toBe(true);
      expect(useBookingWizardStore.getState().currentStep).toBe(3);
    });
  });

  describe("back navigation", () => {
    it("returns from Step 3 to Step 2 with the time slot still populated", () => {
      const timeSlot = { startTime: "2026-08-01T10:00", endTime: "2026-08-01T12:00" };
      act(() => useBookingWizardStore.getState().setWorkspaceId("workspace-1"));
      act(() => useBookingWizardStore.getState().nextStep());
      act(() => useBookingWizardStore.getState().setTimeSlot(timeSlot));
      act(() => useBookingWizardStore.getState().nextStep());

      expect(useBookingWizardStore.getState().currentStep).toBe(3);

      act(() => useBookingWizardStore.getState().prevStep());

      expect(useBookingWizardStore.getState().currentStep).toBe(2);
      expect(useBookingWizardStore.getState().timeSlot).toEqual(timeSlot);
    });
  });

  describe("goToStep", () => {
    it("only allows jumping to an earlier step", () => {
      act(() => useBookingWizardStore.getState().setWorkspaceId("workspace-1"));
      act(() => useBookingWizardStore.getState().nextStep());
      expect(useBookingWizardStore.getState().currentStep).toBe(2);

      act(() => useBookingWizardStore.getState().goToStep(3));
      expect(useBookingWizardStore.getState().currentStep).toBe(2);

      act(() => useBookingWizardStore.getState().goToStep(1));
      expect(useBookingWizardStore.getState().currentStep).toBe(1);
    });
  });
});
