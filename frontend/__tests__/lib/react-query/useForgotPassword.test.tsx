import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForgotPassword } from "@/lib/react-query/hooks/auth/useForgotPassword";
import * as apiClient from "@/lib/apiClient";

// Mock the apiClient module
jest.mock("@/lib/apiClient");

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

describe("useForgotPassword", () => {
  let mockPost: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the post function
    mockPost = jest.fn();
    (apiClient.post as jest.Mock) = mockPost;
  });

  describe("on success", () => {
    it("should show success message on successful forgot password request", async () => {
      const successResponse = { message: "Password reset link sent to your email" };
      mockPost.mockResolvedValueOnce(successResponse);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      const email = "user@example.com";

      await act(async () => {
        result.current.mutate(email);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", { email });
      expect(result.current.data).toEqual(successResponse);
      expect(result.current.data?.message).toBeDefined();
    });

    it("should set data with success message", async () => {
      const successResponse = { message: "Check your email for reset instructions" };
      mockPost.mockResolvedValueOnce(successResponse);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("test@example.com");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(successResponse);
    });

    it("should handle success response with additional metadata", async () => {
      const successResponse = {
        message: "Password reset email sent",
        expiresIn: 3600,
        timestamp: new Date().toISOString(),
      };
      mockPost.mockResolvedValueOnce(successResponse);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(successResponse);
    });

    it("should handle multiple successful requests", async () => {
      const successResponse = { message: "Email sent" };
      mockPost.mockResolvedValue(successResponse);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user1@example.com");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", { email: "user1@example.com" });

      // Reset for second request
      jest.clearAllMocks();
      mockPost.mockResolvedValueOnce(successResponse);
      (apiClient.post as jest.Mock) = mockPost;

      await act(async () => {
        result.current.mutate("user2@example.com");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", { email: "user2@example.com" });
    });
  });

  describe("on error", () => {
    it("should show error message on failed request", async () => {
      const error = new Error("User not found");
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("nonexistent@example.com");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe("User not found");
    });

    it("should handle 404 not found error", async () => {
      const error = new Error("Not Found");
      (error as any).response = { status: 404, data: { message: "User not found" } };
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("unknown@example.com");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should handle 400 bad request error (invalid email)", async () => {
      const error = new Error("Bad Request");
      (error as any).response = { status: 400, data: { message: "Invalid email format" } };
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("invalid-email");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should handle 429 too many requests error", async () => {
      const error = new Error("Too Many Requests");
      (error as any).response = { status: 429, data: { message: "Too many reset requests. Try again later." } };
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should handle 500 server error", async () => {
      const error = new Error("Internal Server Error");
      (error as any).response = { status: 500 };
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should handle network error", async () => {
      const error = new Error("Network Error");
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("Network Error");
    });

    it("should handle timeout error", async () => {
      const error = new Error("Request timeout");
      (error as any).code = "ECONNABORTED";
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe("mutation state", () => {
    it("should set isPending to true while mutation is in progress", async () => {
      let resolveRequest: (value: any) => void;
      const requestPromise = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      mockPost.mockReturnValueOnce(requestPromise);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      act(() => {
        resolveRequest!({ message: "Email sent" });
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

      const { result } = renderHook(() => useForgotPassword(), { wrapper });

      act(() => {
        result.current.mutate("user@example.com");
      });

      const [mutation] = testQueryClient.getMutationCache().getAll();
      expect(mutation?.options.mutationKey).toEqual(["auth", "forgot-password"]);
    });

    it("should reset error state on new mutation", async () => {
      const error = new Error("User not found");
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      // First request fails
      await act(async () => {
        result.current.mutate("nonexistent@example.com");
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();

      // Second request succeeds
      mockPost.mockResolvedValueOnce({ message: "Email sent" });

      await act(async () => {
        result.current.mutate("valid@example.com");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle email with special characters", async () => {
      const successResponse = { message: "Email sent" };
      mockPost.mockResolvedValueOnce(successResponse);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      const specialEmail = "user+tag@example.co.uk";

      await act(async () => {
        result.current.mutate(specialEmail);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", { email: specialEmail });
    });

    it("should handle email with subdomain", async () => {
      const successResponse = { message: "Email sent" };
      mockPost.mockResolvedValueOnce(successResponse);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      const subdomainEmail = "user@mail.example.com";

      await act(async () => {
        result.current.mutate(subdomainEmail);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", { email: subdomainEmail });
    });

    it("should handle rapid successive requests", async () => {
      const successResponse = { message: "Email sent" };
      mockPost.mockResolvedValue(successResponse);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user1@example.com");
        result.current.mutate("user2@example.com");
        result.current.mutate("user3@example.com");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    it("should handle empty response gracefully", async () => {
      mockPost.mockResolvedValueOnce({});

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({});
    });

    it("should handle response with null message", async () => {
      const successResponse = { message: null };
      mockPost.mockResolvedValueOnce(successResponse);

      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("user@example.com");
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(successResponse);
    });
  });
});
