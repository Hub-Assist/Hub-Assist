import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "@/app/profile/page";

const mockMutate = jest.fn();
const mockShowToast = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock("@/hooks/useUpdateProfile", () => ({
  useUpdateProfile: () => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
  }),
}));

jest.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/lib/store/authStore", () => {
  const actual = jest.requireActual("@/lib/store/authStore");
  return {
    ...actual,
    useAuthStore: () => ({
      user: {
        id: "1",
        firstname: "John",
        lastname: "Doe",
        email: "john@test.com",
        name: "John Doe",
        role: "member",
        verified: true,
        active: true,
        joinedDate: "2024-01-01",
        createdAt: "",
        updatedAt: "",
      },
      updateUser: mockUpdateUser,
    }),
  };
});

describe("ProfilePage", () => {
  beforeEach(() => {
    mockMutate.mockClear();
    mockShowToast.mockClear();
    mockUpdateUser.mockClear();
  });

  it("renders first name and last name fields", () => {
    render(<ProfilePage />);
    expect(screen.getByPlaceholderText("Enter your first name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your last name")).toBeInTheDocument();
  });

  it("shows validation error when first name is shorter than 2 characters", async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByPlaceholderText("Enter your first name"), { target: { value: "J" } });
    fireEvent.click(screen.getByRole("button", { name: /update profile/i }));
    await waitFor(() => {
      expect(screen.getByText(/first name must be at least 2 characters/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("shows validation error when last name is shorter than 2 characters", async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByPlaceholderText("Enter your last name"), { target: { value: "D" } });
    fireEvent.click(screen.getByRole("button", { name: /update profile/i }));
    await waitFor(() => {
      expect(screen.getByText(/last name must be at least 2 characters/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("disables submit button when form is not dirty", () => {
    render(<ProfilePage />);
    const submitButton = screen.getByRole("button", { name: /update profile/i });
    expect(submitButton).toBeDisabled();
  });

  it("shows unsaved changes indicator when form is dirty", async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByPlaceholderText("Enter your first name"), { target: { value: "Jane" } });
    await waitFor(() => {
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    });
  });

  it("sends only dirty fields in PATCH request", async () => {
    mockMutate.mockImplementation((_payload: Record<string, unknown>, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
      return Promise.resolve();
    });

    render(<ProfilePage />);
    fireEvent.change(screen.getByPlaceholderText("Enter your first name"), { target: { value: "Jane" } });
    fireEvent.click(screen.getByRole("button", { name: /update profile/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { firstname: "Jane" },
        expect.any(Object),
      );
    });
  });

  it("does not send unchanged fields in PATCH request", async () => {
    mockMutate.mockImplementation((_payload: Record<string, unknown>, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
      return Promise.resolve();
    });

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /update profile/i }));

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  it("rolls back form values on API error", async () => {
    mockMutate.mockImplementation((_payload: Record<string, unknown>, options?: { onError?: () => void }) => {
      options?.onError?.();
      return Promise.resolve();
    });

    render(<ProfilePage />);
    const firstNameInput = screen.getByPlaceholderText("Enter your first name") as HTMLInputElement;

    expect(firstNameInput.value).toBe("John");

    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    fireEvent.click(screen.getByRole("button", { name: /update profile/i }));

    await waitFor(() => {
      expect(firstNameInput.value).toBe("John");
    });
  });
});
