import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRegisterUser } from "@/lib/react-query/hooks/auth/useRegisterUser";
import { useAuthStore } from "@/lib/store/authStore";
import * as apiClient from "@/lib/apiClient";
import type { User } from "@/types/user";

// Mock the apiClient module
jest.mock("@/lib/apiClient");

// Mock the authStore
jest.mock("@/lib/store/authStore");

// Mock next/router for navigation
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock next/navigation for app router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Helper to create valid JWT token
const makeToken = (expOffset = 3600) => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffset }));
  return `header.${payload}.sig`;
};

// Helper to create a QueryClient for tests
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Wrapper component for React Query
const createWrapper = () => {
  const testQueryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
  );
};

describe("useRegisterUser", () => {
  let mockPost: jest.Mock;
  let mockRegister: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the post function
    mockPost = jest.fn();
    (apiClient.post as jest.Mock) = mockPost;

    // Mock the authStore register method
    mockRegister = jest.fn();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const store = { register: mockRegister };
      return selector(store);
    });
  });

  describe("on success", () => {
    it("should call authStore.register with response data when access_token is present", async () => {
      const token = makeToken();
      const user: User = {
        id: "1",
        firstname: "Jane",
        lastname: "Smith",
        email: "jane@example.com",
        role: "member",
        verified: false,
        active: true,
        joinedDate: "2024-01-01",
        name: "Jane Smith",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };

      const registerResponse = { access_token: token, user };
      mockPost.mockResolvedValueOnce(registerResponse);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      const payload = {
        firstname: "Jane",
        lastname: "Smith",
        email: "jane@example.com",
        password: "SecurePass123!",
      };

      await act(async () => {
        result.current.mutate(payload);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/register", payload);
      expect(mockRegister).toHaveBeenCalledWith({
        access_token: token,
        user,
      });
    });

    it("should not call authStore.register when access_token is missing", async () => {
      const registerResponse = { message: "Registration successful, please verify email" };
      mockPost.mockResolvedValueOnce(registerResponse);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      const payload = {
        firstname: "John",
        lastname: "Doe",
        email: "john@example.com",
        password: "SecurePass123!",
      };

      await act(async () => {
        result.current.mutate(payload);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockRegister).not.toHaveBeenCalled();
    });

    it("should set data on successful registration", async () => {
      const token = makeToken();
      const registerResponse = { access_token: token };
      mockPost.mockResolvedValueOnce(registerResponse);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      const payload = {
        firstname: "Test",
        lastname: "User",
        email: "test@example.com",
        password: "pass123",
      };

      await act(async () => {
        result.current.mutate(payload);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(registerResponse);
    });

    it("should handle registration with user data but no token", async () => {
      const user: User = {
        id: "1",
        firstname: "Jane",
        lastname: "Smith",
        email: "jane@example.com",
        role: "member",
        verified: false,
        active: true,
        joinedDate: "2024-01-01",
        name: "Jane Smith",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };

      const registerResponse = { user, message: "Please verify your email" };
      mockPost.mockResolvedValueOnce(registerResponse);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          firstname: "Jane",
          lastname: "Smith",
          email: "jane@example.com",
          password: "pass",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe("on error", () => {
    it("should set error state on failed registration", async () => {
      const error = new Error("Email already exists");
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          firstname: "Jane",
          lastname: "Smith",
          email: "existing@example.com",
          password: "pass",
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it("should display error message on validation failure", async () => {
      const error = new Error("Password too weak");
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          firstname: "Jane",
          lastname: "Smith",
          email: "jane@example.com",
          password: "weak",
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("Password too weak");
    });

    it("should handle 409 conflict error (email exists)", async () => {
      const error = new Error("Conflict");
      (error as any).response = { status: 409, data: { message: "Email already registered" } };
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          firstname: "Jane",
          lastname: "Smith",
          email: "taken@example.com",
          password: "pass",
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should handle 400 bad request error", async () => {
      const error = new Error("Bad Request");
      (error as any).response = { status: 400, data: { message: "Invalid input" } };
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          firstname: "",
          lastname: "Smith",
          email: "invalid-email",
          password: "pass",
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should handle network error", async () => {
      const error = new Error("Network Error");
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          firstname: "Jane",
          lastname: "Smith",
          email: "jane@example.com",
          password: "pass",
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe("mutation state", () => {
    it("should set isPending to true while mutation is in progress", async () => {
      let resolveRegister: (value: any) => void;
      const registerPromise = new Promise((resolve) => {
        resolveRegister = resolve;
      });

      mockPost.mockReturnValueOnce(registerPromise);

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({
          firstname: "Jane",
          lastname: "Smith",
          email: "jane@example.com",
          password: "pass",
        });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      act(() => {
        resolveRegister!({ access_token: makeToken() });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });

    it("should register the mutation under the correct mutation key", () => {
      const testQueryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
      );

      mockPost.mockReturnValueOnce(new Promise(() => {}));

      const { result } = renderHook(() => useRegisterUser(), { wrapper });

      act(() => {
        result.current.mutate({
          firstname: "Jane",
          lastname: "Smith",
          email: "jane@example.com",
          password: "pass",
        });
      });

      const [mutation] = testQueryClient.getMutationCache().getAll();
      expect(mutation?.options.mutationKey).toEqual(["auth", "register"]);
    });
  });

  describe("edge cases", () => {
    it("should handle registration with special characters in name", async () => {
      const token = makeToken();
      mockPost.mockResolvedValueOnce({ access_token: token });

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      const payload = {
        firstname: "José",
        lastname: "García-López",
        email: "jose@example.com",
        password: "pass",
      };

      await act(async () => {
        result.current.mutate(payload);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/register", payload);
    });

    it("should handle registration with long email", async () => {
      const token = makeToken();
      mockPost.mockResolvedValueOnce({ access_token: token });

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      const longEmail = "very.long.email.address.with.many.parts@subdomain.example.com";
      const payload = {
        firstname: "Test",
        lastname: "User",
        email: longEmail,
        password: "pass",
      };

      await act(async () => {
        result.current.mutate(payload);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/register", payload);
    });

    it("should handle rapid successive registrations", async () => {
      const token = makeToken();
      mockPost.mockResolvedValue({ access_token: token });

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          firstname: "User1",
          lastname: "Test",
          email: "user1@example.com",
          password: "pass",
        });
        result.current.mutate({
          firstname: "User2",
          lastname: "Test",
          email: "user2@example.com",
          password: "pass",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it("should handle empty response gracefully", async () => {
      mockPost.mockResolvedValueOnce({});

      const { result } = renderHook(() => useRegisterUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          firstname: "Test",
          lastname: "User",
          email: "test@example.com",
          password: "pass",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockRegister).not.toHaveBeenCalled();
    });
  });
});
