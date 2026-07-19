# Profile Settings Form Rebuild

## Branch
`feat/frontend/profile-settings-form`

## Overview
Rebuilt the `/profile` settings form using React Hook Form + Zod validation with field-level dirty tracking, optimistic API update, and automatic rollback to saved values on API error.

## Files Changed

### 1. `frontend/src/lib/schemas/profileSchema.ts`
- Bumped `firstname` and `lastname` minimum length from `1` to `2` characters.
- This mirrors the backend `UpdateUserDto` constraints and satisfies the requirement that names shorter than 2 chars trigger a Zod validation error.

### 2. `frontend/src/hooks/useUpdateProfile.ts`
- Added `mapToBackend()` utility to translate frontend camelCase fields (`firstname`, `lastname`) to the backend’s expected `firstName` and `lastName` keys.
- Exposed `UseMutationOptions` parameter so the component can inject per-submission `onSuccess` and `onError` handlers without overriding the hook’s defaults.
- Kept the existing toast feedback and Zustand store sync behavior.

### 3. `frontend/src/app/profile/page.tsx`
- Imported the shared `profileSchema` and `ProfileFormValues` from `@/lib/schemas/profileSchema` instead of defining an inline schema.
- Introduced `savedValuesRef` to track the last known good state of the form.
- Replaced the old submit handler with a dirty-tracking implementation:
  - Uses `getValues()` to read the current form state.
  - Compares against `savedValuesRef.current` to build a `payload` containing only changed fields.
  - If nothing changed, shows a toast and aborts.
- Wired `useUpdateProfile` callbacks:
  - **onSuccess:** updates `savedValuesRef`, resets the form to the new values, and syncs the Zustand store.
  - **onError:** resets the form back to `savedValuesRef.current`, rolling back any user edits.
- Added an “Unsaved changes” indicator (`AlertCircle` badge) that appears when `profileForm.formState.isDirty` is true.
- Disabled the submit button when the form is not dirty or while the mutation is pending.
- Kept the password change and avatar upload functionality intact.

### 4. `frontend/src/app/profile/__tests__/ProfilePage.test.tsx` (new)
Added 8 unit tests:
1. Renders first name and last name fields.
2. Shows validation error when first name is shorter than 2 characters.
3. Shows validation error when last name is shorter than 2 characters.
4. Disables submit button when form is not dirty.
5. Shows unsaved changes indicator when form is dirty.
6. Sends only dirty fields in the PATCH request body.
7. Does not send unchanged fields in the PATCH request body.
8. Rolls back form values to pre-edit state on API error.

### 5. `.gitignore`
- Added `*.tsbuildinfo` to prevent TypeScript build info files from being committed.

## Behavior Summary
- **Dirty tracking:** Only fields that differ from the last saved state are included in the PATCH request.
- **Validation:** Client-side Zod schema enforces a minimum of 2 characters for both first and last names.
- **Optimistic UI:** On success, the form and auth store are updated immediately.
- **Error rollback:** On failure, the form resets to the previous saved values so the user never sees a half-applied state.
- **UX indicators:** An “Unsaved changes” badge is shown when the form is dirty, and the submit button is disabled until there is something to save.
