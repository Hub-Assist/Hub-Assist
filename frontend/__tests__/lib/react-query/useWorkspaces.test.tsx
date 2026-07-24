import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { useWorkspaces } from "@/lib/react-query/hooks/workspaces/useWorkspaces";
import * as apiClient from "@/lib/apiClient";
import { createWrapper } from "./test-utils";
import type { Workspace } from "@/types/workspace";

jest.mock("@/lib/apiClient");

const makeWorkspace = (overrides?: Partial<Workspace>): Workspace => ({
  id: "ws-1",
  name: "Open Desk",
  type: "desk",
  capacity: 1,
  pricePerHour: 10,
  availability: true,
  description: "A comfortable open desk",
  amenities: [],
  images: [],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("useWorkspaces", () => {
  let mockGetWorkspaces: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWorkspaces = jest.fn();
    (apiClient.api as any) = {
      ...(apiClient.api as any),
      getWorkspaces: mockGetWorkspaces,
    };
  });

  it("calls getWorkspaces with no params when no options are provided", async () => {
    mockGetWorkspaces.mockResolvedValueOnce({ workspaces: [makeWorkspace()] });

    const { result } = renderHook(() => useWorkspaces(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetWorkspaces).toHaveBeenCalledWith({});
  });

  it("does not include search in params when query is a single character", async () => {
    mockGetWorkspaces.mockResolvedValueOnce({ workspaces: [] });

    const { result } = renderHook(() => useWorkspaces({ search: "a" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // search="a" — below 2-char minimum — should not appear in params
    expect(mockGetWorkspaces).toHaveBeenCalledWith({});
  });

  it("does not include search in params when query is empty", async () => {
    mockGetWorkspaces.mockResolvedValueOnce({ workspaces: [] });

    const { result } = renderHook(() => useWorkspaces({ search: "" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetWorkspaces).toHaveBeenCalledWith({});
  });

  it("includes search in params when query is 2 or more characters", async () => {
    mockGetWorkspaces.mockResolvedValueOnce({ workspaces: [makeWorkspace()] });

    const { result } = renderHook(() => useWorkspaces({ search: "de" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetWorkspaces).toHaveBeenCalledWith({ search: "de" });
  });

  it("trims the search string before passing it to the API", async () => {
    mockGetWorkspaces.mockResolvedValueOnce({ workspaces: [] });

    const { result } = renderHook(() => useWorkspaces({ search: "  desk  " }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetWorkspaces).toHaveBeenCalledWith({ search: "desk" });
  });

  it("includes filter params alongside search", async () => {
    mockGetWorkspaces.mockResolvedValueOnce({ workspaces: [] });

    const { result } = renderHook(
      () => useWorkspaces({ search: "office", type: "office", availability: true }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetWorkspaces).toHaveBeenCalledWith({
      search: "office",
      type: "office",
      availability: true,
    });
  });

  it("uses different query keys for different search terms (cache isolation)", () => {
    // We verify this behaviorally: the two hooks fetch independently with
    // different params, meaning React Query treats them as separate cache entries.
    mockGetWorkspaces
      .mockResolvedValueOnce({ workspaces: [makeWorkspace({ id: "ws-desk", name: "Desk" })] })
      .mockResolvedValueOnce({ workspaces: [makeWorkspace({ id: "ws-office", name: "Office" })] });

    const wrapperInstance = createWrapper();
    const { result: r1 } = renderHook(() => useWorkspaces({ search: "desk" }), {
      wrapper: wrapperInstance,
    });
    const { result: r2 } = renderHook(() => useWorkspaces({ search: "office" }), {
      wrapper: wrapperInstance,
    });

    // Both hooks were rendered — each will call the API independently
    expect(mockGetWorkspaces).toHaveBeenCalledWith({ search: "desk" });
    expect(mockGetWorkspaces).toHaveBeenCalledWith({ search: "office" });
    expect(mockGetWorkspaces).toHaveBeenCalledTimes(2);

    // Suppress unused variable warnings — results exist, hooks rendered
    void r1;
    void r2;
  });

  it("returns workspace data correctly when query succeeds", async () => {
    const workspaces = [makeWorkspace({ id: "ws-1", name: "Cozy Office" })];
    mockGetWorkspaces.mockResolvedValueOnce({ workspaces });

    const { result } = renderHook(() => useWorkspaces({ search: "cozy" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.workspaces).toEqual(workspaces);
  });

  it("exposes isError when the API call fails", async () => {
    mockGetWorkspaces.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useWorkspaces({ search: "fail" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
