## Fix BookingForm cache invalidation and add Stellar client resilience

### Overview
This PR addresses critical issues in the booking flow and payment infrastructure, specifically fixing cache invalidation in `BookingForm` and adding resilience to the Stellar transaction polling logic.

### Changes

#### 1. BookingForm Cache Invalidation Fix
**Problem:** The `BookingForm` component was bypassing the `useCreateBooking` mutation hook and manually calling `api.createBooking()` with local state management. This prevented proper cache invalidation, leaving the user's booking list stale after successful bookings. Additionally, the component was using an inline `useQuery` instead of the dedicated `useWorkspaces` hook.

**Solution:**
- Refactored `BookingForm.tsx` to use the existing `useCreateBooking` mutation hook
- Replaced inline `useQuery({queryKey:["workspaces"]...})` with the dedicated `useWorkspaces` hook
- Ensured proper cache invalidation via `queryClient.invalidateQueries({queryKey:["bookings"]})` on successful booking
- Removed redundant `isBooking` state in favor of the mutation's built-in `isPending` state

**Files Changed:**
- `frontend/src/components/workspaces/BookingForm.tsx`

#### 2. Stellar Transaction Polling Resilience
**Problem:** The transaction confirmation polling loop in `contractClient.ts` had no timeout or maximum attempts, creating a risk of indefinite UI hangs if a transaction was dropped or stuck.

**Solution:**
- Added configurable timeout (default: 30 seconds) and max attempts (default: 30) to the polling loop
- Introduced typed error states for timeout scenarios
- Surface clear error messages to callers when transaction confirmation times out
- Maintained backward compatibility with existing contract invocation code

**Files Changed:**
- `frontend/src/lib/stellar/contractClient.ts`
- Added `TransactionTimeoutError` class for typed error handling

#### 3. Stellar Client Test Coverage
**Problem:** Critical payment path code (`walletClient.ts` and `contractClient.ts`) had zero test coverage despite handling wallet connections and transaction signing.

**Solution:**
- Added comprehensive unit tests for `walletClient.ts`
  - Wallet installation detection
  - Connection flow and error handling
  - Public key retrieval
  - Transaction signing
- Added comprehensive unit tests for `contractClient.ts`
  - Contract invocation flow
  - Polling timeout behavior
  - Error propagation
  - Network configuration
- Used mocks for Freighter API and Stellar RPC to ensure fast, reliable tests

**Files Added:**
- `frontend/src/lib/stellar/__tests__/walletClient.test.ts`
- `frontend/src/lib/stellar/__tests__/contractClient.test.ts`

### Testing
- ✅ Manual testing: Verified booking flow correctly updates booking list
- ✅ Manual testing: Confirmed workspace list uses proper hook
- ✅ Unit tests: All Stellar client tests pass (wallet + contract)
- ✅ Integration testing: Verified timeout behavior with simulated slow transactions
- ✅ Regression testing: Existing booking functionality unchanged

### Impact
- **User-facing:** Booking list now updates immediately after successful bookings
- **Developer experience:** Clearer error messages when Stellar transactions timeout
- **Code quality:** Payment-critical path now has test coverage
- **Reliability:** No more indefinite UI hangs on stuck transactions

### Breaking Changes
None. All changes are backward compatible.

### Related Issues
Closes #460

### Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] Tests added/updated
- [x] All tests passing
- [x] No console errors or warnings
- [x] Documentation updated where needed
