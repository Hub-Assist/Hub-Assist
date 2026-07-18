import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type WizardStep = 1 | 2 | 3 | 4;

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface PaymentDetails {
  confirmed: boolean;
}

export function isValidTimeRange(timeSlot: TimeSlot | null): boolean {
  if (!timeSlot?.startTime || !timeSlot?.endTime) return false;
  return new Date(timeSlot.endTime) > new Date(timeSlot.startTime);
}

interface BookingWizardState {
  currentStep: WizardStep;
  workspaceId: string | null;
  timeSlot: TimeSlot | null;
  paymentDetails: PaymentDetails;
  lastBookingId: string | null;
}

interface BookingWizardActions {
  setWorkspaceId: (workspaceId: string) => void;
  setTimeSlot: (timeSlot: TimeSlot) => void;
  setPaymentDetails: (details: Partial<PaymentDetails>) => void;
  canAdvance: (step: WizardStep) => boolean;
  nextStep: () => boolean;
  prevStep: () => void;
  goToStep: (step: WizardStep) => void;
  completeBooking: (bookingId: string) => void;
  reset: () => void;
}

type BookingWizardStore = BookingWizardState & BookingWizardActions;

const initialState: BookingWizardState = {
  currentStep: 1,
  workspaceId: null,
  timeSlot: null,
  paymentDetails: { confirmed: false },
  lastBookingId: null,
};

export const useBookingWizardStore = create<BookingWizardStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setWorkspaceId: (workspaceId) => set({ workspaceId }),
      setTimeSlot: (timeSlot) => set({ timeSlot }),
      setPaymentDetails: (details) =>
        set((state) => ({ paymentDetails: { ...state.paymentDetails, ...details } })),

      canAdvance: (step) => {
        const state = get();
        switch (step) {
          case 1:
            return !!state.workspaceId;
          case 2:
            return isValidTimeRange(state.timeSlot);
          case 3:
            return state.paymentDetails.confirmed;
          case 4:
            return false;
        }
      },

      nextStep: () => {
        const state = get();
        if (!state.canAdvance(state.currentStep)) return false;
        if (state.currentStep >= 4) return false;
        set({ currentStep: (state.currentStep + 1) as WizardStep });
        return true;
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep <= 1) return;
        set({ currentStep: (currentStep - 1) as WizardStep });
      },

      goToStep: (step) => {
        const { currentStep } = get();
        if (step >= currentStep) return;
        set({ currentStep: step });
      },

      completeBooking: (bookingId) => set({ lastBookingId: bookingId, currentStep: 4 }),

      reset: () => set(initialState),
    }),
    {
      name: 'booking-wizard-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        workspaceId: state.workspaceId,
        timeSlot: state.timeSlot,
        paymentDetails: state.paymentDetails,
        lastBookingId: state.lastBookingId,
      }),
    }
  )
);
