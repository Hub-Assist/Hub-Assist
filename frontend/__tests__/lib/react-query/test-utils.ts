import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/**
 * Creates a QueryClient configured for testing with disabled retries
 * and optimized for fast test execution
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

/**
 * Creates a wrapper component for React Query that can be used with renderHook
 * Usage: renderHook(() => useMyHook(), { wrapper: createWrapper() })
 */
export const createWrapper = () => {
  const testQueryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: testQueryClient }, children);
};

/**
 * Helper to create a valid JWT token for testing
 * @param expOffset - Seconds until token expiration (default: 3600 = 1 hour)
 * @returns A valid JWT token string
 */
export const makeToken = (expOffset = 3600): string => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffset }));
  return `header.${payload}.sig`;
};

/**
 * Helper to create an expired JWT token for testing
 * @returns An expired JWT token string
 */
export const makeExpiredToken = (): string => makeToken(-3600);

/**
 * Mock response builders for common API responses
 */
export const mockResponses = {
  loginSuccess: (token?: string, user?: any) => ({
    access_token: token || makeToken(),
    user,
  }),

  registerSuccess: (token?: string, user?: any) => ({
    access_token: token || makeToken(),
    user,
  }),

  forgotPasswordSuccess: (message = "Password reset link sent to your email") => ({
    message,
  }),

  errorResponse: (message: string, status: number) => {
    const error = new Error(message);
    (error as any).response = { status, data: { message } };
    return error;
  },
};

/**
 * Mock error builders for common error scenarios
 */
export const mockErrors = {
  unauthorized: () => mockResponses.errorResponse("Unauthorized", 401),
  notFound: () => mockResponses.errorResponse("Not Found", 404),
  badRequest: () => mockResponses.errorResponse("Bad Request", 400),
  conflict: () => mockResponses.errorResponse("Conflict", 409),
  tooManyRequests: () => mockResponses.errorResponse("Too Many Requests", 429),
  serverError: () => mockResponses.errorResponse("Internal Server Error", 500),
  networkError: () => new Error("Network Error"),
  timeoutError: () => {
    const error = new Error("Request timeout");
    (error as any).code = "ECONNABORTED";
    return error;
  },
};
