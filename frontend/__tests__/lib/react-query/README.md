# React Query Mutation Hooks Integration Tests

This directory contains comprehensive integration tests for React Query mutation hooks used in the authentication flow.

## Test Files

### `useLoginUser.test.tsx`
Tests for the login mutation hook that handles user authentication.

**Coverage:**
- ✅ On success: calls `authStore.login()` with response data
- ✅ On success: sets data on successful login
- ✅ On success: handles login without user data
- ✅ On error: sets error state on failed login
- ✅ On error: does not call `authStore.login()` on error
- ✅ On error: handles 401 unauthorized error
- ✅ On error: handles 500 server error
- ✅ Mutation state: tracks `isPending` correctly
- ✅ Mutation state: uses correct mutation key
- ✅ Edge cases: handles rapid successive mutations
- ✅ Edge cases: handles empty response gracefully

### `useRegisterUser.test.tsx`
Tests for the registration mutation hook that handles user registration.

**Coverage:**
- ✅ On success: calls `authStore.register()` when `access_token` is present
- ✅ On success: does not call `authStore.register()` when `access_token` is missing
- ✅ On success: sets data on successful registration
- ✅ On success: handles registration with user data but no token
- ✅ On error: sets error state on failed registration
- ✅ On error: displays error message on validation failure
- ✅ On error: handles 409 conflict error (email exists)
- ✅ On error: handles 400 bad request error
- ✅ On error: handles network error
- ✅ Mutation state: tracks `isPending` correctly
- ✅ Mutation state: uses correct mutation key
- ✅ Edge cases: handles special characters in names
- ✅ Edge cases: handles long email addresses
- ✅ Edge cases: handles rapid successive registrations

### `useForgotPassword.test.tsx`
Tests for the forgot password mutation hook that handles password reset requests.

**Coverage:**
- ✅ On success: shows success message on successful request
- ✅ On success: sets data with success message
- ✅ On success: handles success response with additional metadata
- ✅ On success: handles multiple successful requests
- ✅ On error: shows error message on failed request
- ✅ On error: handles 404 not found error
- ✅ On error: handles 400 bad request error (invalid email)
- ✅ On error: handles 429 too many requests error
- ✅ On error: handles 500 server error
- ✅ On error: handles network error
- ✅ On error: handles timeout error
- ✅ Mutation state: tracks `isPending` correctly
- ✅ Mutation state: uses correct mutation key
- ✅ Mutation state: resets error state on new mutation
- ✅ Edge cases: handles email with special characters
- ✅ Edge cases: handles email with subdomain
- ✅ Edge cases: handles rapid successive requests

## Test Utilities

### `test-utils.ts`
Provides reusable test utilities and helpers:

- **`createTestQueryClient()`** - Creates a QueryClient optimized for testing
- **`createWrapper()`** - Creates a wrapper component for React Query provider
- **`makeToken(expOffset?)`** - Generates valid JWT tokens for testing
- **`makeExpiredToken()`** - Generates expired JWT tokens
- **`mockResponses`** - Object with helper functions for common API responses
- **`mockErrors`** - Object with helper functions for common error scenarios

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test useLoginUser.test.tsx

# Run tests matching a pattern
npm test -- --testNamePattern="on success"
```

## Test Structure

Each test file follows this structure:

1. **Setup**
   - Import necessary testing utilities
   - Mock external dependencies (apiClient, authStore)
   - Create test wrappers and helpers

2. **Test Suites**
   - `describe("on success")` - Tests for successful mutations
   - `describe("on error")` - Tests for error handling
   - `describe("mutation state")` - Tests for loading/pending states
   - `describe("edge cases")` - Tests for boundary conditions

3. **Cleanup**
   - `beforeEach()` - Clears mocks before each test
   - `afterEach()` - Cleanup if needed

## Mocking Strategy

### API Client Mocking
```typescript
jest.mock("@/lib/apiClient");
const mockPost = jest.fn();
(apiClient.post as jest.Mock) = mockPost;
```

### Auth Store Mocking
```typescript
jest.mock("@/lib/store/authStore");
const mockLogin = jest.fn();
(useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
  const store = { login: mockLogin };
  return selector(store);
});
```

## Best Practices

1. **Isolation** - Each test is independent and doesn't affect others
2. **Clarity** - Test names clearly describe what is being tested
3. **Completeness** - Tests cover success, error, and edge cases
4. **Maintainability** - Shared utilities reduce code duplication
5. **Performance** - Tests run quickly with disabled retries and garbage collection

## Common Patterns

### Testing Successful Mutations
```typescript
it("should call authStore.login with response data", async () => {
  const token = makeToken();
  const loginResponse = { access_token: token };
  mockPost.mockResolvedValueOnce(loginResponse);

  const { result } = renderHook(() => useLoginUser(), {
    wrapper: createWrapper(),
  });

  await act(async () => {
    result.current.mutate(payload);
  });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(mockLogin).toHaveBeenCalledWith(loginResponse);
});
```

### Testing Error Handling
```typescript
it("should set error state on failed login", async () => {
  const error = new Error("Invalid credentials");
  mockPost.mockRejectedValueOnce(error);

  const { result } = renderHook(() => useLoginUser(), {
    wrapper: createWrapper(),
  });

  await act(async () => {
    result.current.mutate(payload);
  });

  await waitFor(() => {
    expect(result.current.isError).toBe(true);
  });

  expect(result.current.error).toBeDefined();
});
```

### Testing Pending State
```typescript
it("should set isPending to true while mutation is in progress", async () => {
  let resolveLogin: (value: any) => void;
  const loginPromise = new Promise((resolve) => {
    resolveLogin = resolve;
  });

  mockPost.mockReturnValueOnce(loginPromise);

  const { result } = renderHook(() => useLoginUser(), {
    wrapper: createWrapper(),
  });

  act(() => {
    result.current.mutate(payload);
  });

  expect(result.current.isPending).toBe(true);

  act(() => {
    resolveLogin!({ access_token: makeToken() });
  });

  await waitFor(() => {
    expect(result.current.isPending).toBe(false);
  });
});
```

## Troubleshooting

### Tests Timing Out
- Ensure `waitFor()` has appropriate timeout
- Check that mocks are properly resolved/rejected
- Verify `act()` is wrapping state updates

### Mock Not Being Called
- Verify mock is set up before hook is rendered
- Check that the hook is actually calling the mocked function
- Ensure proper cleanup between tests

### Unexpected State Values
- Use `act()` for all state updates
- Verify `waitFor()` conditions are correct
- Check that mocks return expected data structure

## Coverage Goals

- **Statements**: > 95%
- **Branches**: > 90%
- **Functions**: > 95%
- **Lines**: > 95%

Run `npm run test:coverage` to see current coverage metrics.
