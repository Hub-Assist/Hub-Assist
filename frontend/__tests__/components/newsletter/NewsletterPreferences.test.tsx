import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsletterPreferences } from "@/components/newsletter/NewsletterPreferences";
import type { PreferenceFormData } from "@/components/newsletter/NewsletterPreferences";

const defaultPreferences: PreferenceFormData = {
  workspaceUpdates: true,
  community: true,
  promotions: true,
  productUpdates: true,
};

const mockOnSave = jest.fn();
const mockOnUnsubscribe = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockOnSave.mockResolvedValue(undefined);
  mockOnUnsubscribe.mockResolvedValue(undefined);
});

function renderComponent(overrides: Partial<React.ComponentProps<typeof NewsletterPreferences>> = {}) {
  return render(
    <NewsletterPreferences
      initialPreferences={defaultPreferences}
      onSave={mockOnSave}
      onUnsubscribe={mockOnUnsubscribe}
      {...overrides}
    />
  );
}

describe("NewsletterPreferences", () => {
  describe("rendering", () => {
    it("renders all four topic toggles", () => {
      renderComponent();
      expect(screen.getByLabelText(/workspace updates/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/community events/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/promotions & offers/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/product updates/i)).toBeInTheDocument();
    });

    it("renders privacy policy links for each topic", () => {
      renderComponent();
      const privacyLinks = screen.getAllByRole("link", { name: /privacy policy/i });
      expect(privacyLinks).toHaveLength(4);
      privacyLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/privacy-policy");
      });
    });

    it("renders the save preferences button", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: /save preferences/i })).toBeInTheDocument();
    });

    it("renders the unsubscribe link", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: /unsubscribe from all emails/i })).toBeInTheDocument();
    });

    it("initialises checkboxes with given initialPreferences", () => {
      renderComponent({
        initialPreferences: {
          workspaceUpdates: true,
          community: false,
          promotions: false,
          productUpdates: true,
        },
      });

      expect(screen.getByLabelText(/workspace updates/i)).toBeChecked();
      expect(screen.getByLabelText(/community events/i)).not.toBeChecked();
      expect(screen.getByLabelText(/promotions & offers/i)).not.toBeChecked();
      expect(screen.getByLabelText(/product updates/i)).toBeChecked();
    });

    it("shows a loading spinner when isLoading is true", () => {
      renderComponent({ isLoading: true });
      expect(screen.getByText(/loading your preferences/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /save preferences/i })).not.toBeInTheDocument();
    });
  });

  describe("dirty state", () => {
    it("does not show unsaved-changes indicator when form is pristine", () => {
      renderComponent();
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    });

    it("shows unsaved-changes indicator after toggling a preference", async () => {
      renderComponent();
      const user = userEvent.setup();

      await user.click(screen.getByLabelText(/community events/i));

      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    });

    it("hides unsaved-changes indicator after toggling back to original value", async () => {
      renderComponent();
      const user = userEvent.setup();

      // Toggle off then back on — form should be clean again
      await user.click(screen.getByLabelText(/community events/i));
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();

      await user.click(screen.getByLabelText(/community events/i));
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    });

    it("save button is disabled when form is pristine", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: /save preferences/i })).toBeDisabled();
    });

    it("save button is enabled after a preference is toggled", async () => {
      renderComponent();
      const user = userEvent.setup();

      await user.click(screen.getByLabelText(/community events/i));

      expect(screen.getByRole("button", { name: /save preferences/i })).toBeEnabled();
    });
  });

  describe("submitting with changes", () => {
    it("calls onSave with only changed fields", async () => {
      renderComponent();
      const user = userEvent.setup();

      // Toggle off community only
      await user.click(screen.getByLabelText(/community events/i));
      await user.click(screen.getByRole("button", { name: /save preferences/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      // Only the changed field should be in the payload
      const payload = mockOnSave.mock.calls[0][0];
      expect(payload).toEqual({ community: false });
      expect(payload).not.toHaveProperty("workspaceUpdates");
      expect(payload).not.toHaveProperty("promotions");
      expect(payload).not.toHaveProperty("productUpdates");
    });

    it("calls onSave with multiple changed fields when several are toggled", async () => {
      renderComponent();
      const user = userEvent.setup();

      await user.click(screen.getByLabelText(/community events/i));
      await user.click(screen.getByLabelText(/promotions & offers/i));
      await user.click(screen.getByRole("button", { name: /save preferences/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const payload = mockOnSave.mock.calls[0][0];
      expect(payload).toHaveProperty("community", false);
      expect(payload).toHaveProperty("promotions", false);
      expect(payload).not.toHaveProperty("workspaceUpdates");
      expect(payload).not.toHaveProperty("productUpdates");
    });

    it("does not call onSave when no changes have been made", async () => {
      renderComponent();
      const user = userEvent.setup();

      // Fire submit directly without toggling anything
      // (button is disabled, so we can't click it, but let's verify via form submit)
      const form = screen.getByRole("button", { name: /save preferences/i }).closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        // onSave must NOT have been called because isDirty is false
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it("shows success message after saving", async () => {
      renderComponent();
      const user = userEvent.setup();

      await user.click(screen.getByLabelText(/community events/i));
      await user.click(screen.getByRole("button", { name: /save preferences/i }));

      await waitFor(() => {
        expect(screen.getByText(/preferences saved successfully/i)).toBeInTheDocument();
      });
    });

    it("clears dirty state after a successful save", async () => {
      renderComponent();
      const user = userEvent.setup();

      await user.click(screen.getByLabelText(/community events/i));
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /save preferences/i }));

      await waitFor(() => {
        expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("submitting without changes (edge case via guard)", () => {
    it("skips API call when the form is programmatically submitted with no dirty fields", async () => {
      renderComponent();

      const form = screen.getByRole("button", { name: /save preferences/i }).closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      // Allow any async ticks to settle
      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });
  });

  describe("unsubscribe", () => {
    it("calls onUnsubscribe when the unsubscribe button is clicked", async () => {
      renderComponent();
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /unsubscribe from all emails/i }));

      expect(mockOnUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it("disables unsubscribe button while unsubscribing", () => {
      renderComponent({ isUnsubscribing: true });
      expect(screen.getByRole("button", { name: /unsubscribe from all emails/i })).toBeDisabled();
    });

    it("disables unsubscribe button while saving", () => {
      renderComponent({ isSaving: true });
      expect(screen.getByRole("button", { name: /unsubscribe from all emails/i })).toBeDisabled();
    });
  });
});
