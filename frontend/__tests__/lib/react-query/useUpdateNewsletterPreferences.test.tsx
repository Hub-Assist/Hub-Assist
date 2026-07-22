import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateNewsletterPreferences } from "@/lib/react-query/hooks/newsletter/useUpdateNewsletterPreferences";
import * as apiClient from "@/lib/apiClient";
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

describe("useUpdateNewsletterPreferences", () => {
  let mockUpdateNewsletterPreferences: jest.Mock;
  const token = "test-token-123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateNewsletterPreferences = jest.fn();
    (apiClient.api as any) = {
      ...(apiClient.api as any),
      updateNewsletterPreferences: mockUpdateNewsletterPreferences,
    };
  });

  describe("successful update", () => {
    it("calls api.updateNewsletterPreferences with correct token and data", async () => {
      mockUpdateNewsletterPreferences.mockResolvedValueOnce({ message: "Updated" });

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      const preferences = { community: false, promotions: true };

      await act(async () => {
        result.current.mutate(preferences);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockUpdateNewsletterPreferences).toHaveBeenCalledWith(token, preferences);
      expect(mockUpdateNewsletterPreferences).toHaveBeenCalledTimes(1);
    });

    it("invalidates preferences query after successful update", async () => {
      mockUpdateNewsletterPreferences.mockResolvedValueOnce({ message: "Updated" });

      const queryClient = createTestQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ promotions: false });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["newsletter", "preferences", token],
      });
    });

    it("sets isSuccess to true on successful mutation", async () => {
      mockUpdateNewsletterPreferences.mockResolvedValueOnce({ message: "Updated" });

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ productUpdates: false });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.isError).toBe(false);
      });
    });
  });

  describe("error handling", () => {
    it("sets isError to true when API call fails", async () => {
      mockUpdateNewsletterPreferences.mockRejectedValueOnce(new Error("Server error"));

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ promotions: false });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.isSuccess).toBe(false);
      });
    });

    it("does not invalidate queries when API call fails", async () => {
      mockUpdateNewsletterPreferences.mockRejectedValueOnce(new Error("Network error"));

      const queryClient = createTestQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ community: false });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("mutation state", () => {
    it("sets isPending to true while mutation is in progress", async () => {
      let resolveUpdate!: (value: any) => void;
      mockUpdateNewsletterPreferences.mockReturnValueOnce(
        new Promise((resolve) => { resolveUpdate = resolve; })
      );

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ promotions: false });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));

      act(() => {
        resolveUpdate({ message: "Updated" });
      });

      await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it("registers mutation under the correct mutation key", async () => {
      mockUpdateNewsletterPreferences.mockReturnValueOnce(new Promise(() => {}));

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ community: true });
      });

      const [mutation] = queryClient.getMutationCache().getAll();
      expect(mutation?.options.mutationKey).toEqual(["newsletter", "preferences", "update", token]);
    });
  });

  describe("edge cases", () => {
    it("handles updating a single preference field", async () => {
      mockUpdateNewsletterPreferences.mockResolvedValueOnce({ message: "Updated" });

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ workspaceUpdates: false });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockUpdateNewsletterPreferences).toHaveBeenCalledWith(token, {
        workspaceUpdates: false,
      });
    });

    it("handles updating multiple preference fields", async () => {
      mockUpdateNewsletterPreferences.mockResolvedValueOnce({ message: "Updated" });

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useUpdateNewsletterPreferences(token), {
        wrapper: createWrapper(queryClient),
      });

      const multiplePrefs = {
        workspaceUpdates: false,
        community: true,
        promotions: false,
      };

      await act(async () => {
        result.current.mutate(multiplePrefs);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockUpdateNewsletterPreferences).toHaveBeenCalledWith(token, multiplePrefs);
    });
  });
});
