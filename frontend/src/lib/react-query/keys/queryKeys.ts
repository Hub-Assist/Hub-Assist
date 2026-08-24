/**
 * Centralized React Query key factory.
 *
 * Mirrors the pattern used by `mutationKeys.ts`. All query hooks (and any
 * component that reads/invalidates a hook's cache entries directly) should
 * build keys through this factory instead of hand-writing arrays — a typo in
 * an inline key (e.g. `"booking"` vs `"bookings"`) silently breaks cache
 * invalidation with no compiler error, since query keys are just `unknown[]`.
 */
export const queryKeys = {
  bookings: {
    /** Base key covering every bookings-list query, regardless of filter/tab. */
    all: ["bookings"] as const,
    /** A specific bookings list, optionally scoped to a tab/filter. */
    list: (tab?: string) => (tab ? (["bookings", tab] as const) : (["bookings"] as const)),
    /** A single booking by id. */
    detail: (id: string) => ["booking", id] as const,
  },
  workspaces: {
    /** Base key covering every workspaces-list query. */
    all: ["workspaces"] as const,
    /** The workspace list, filtered/searched per `params`. */
    list: (params?: Record<string, unknown>) => ["workspaces", params] as const,
    /** Hourly availability for one workspace on one date (YYYY-MM-DD, UTC). */
    availability: (workspaceId: string, date: string) =>
      ["workspaces", workspaceId, "availability", date] as const,
  },
  newsletter: {
    /** A subscriber's newsletter preferences, keyed by their unsubscribe token. */
    preferences: (token: string | null) => ["newsletter", "preferences", token] as const,
    /** Marker key touched when a subscriber unsubscribes via `token`. */
    unsubscribe: (token: string) => ["newsletter", "unsubscribe", token] as const,
  },
} as const;
