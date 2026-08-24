import { queryKeys } from "@/lib/react-query/keys/queryKeys";

describe("queryKeys", () => {
  describe("bookings", () => {
    it("all is a stable base key", () => {
      expect(queryKeys.bookings.all).toEqual(["bookings"]);
    });

    it("list() with no tab returns the base key", () => {
      expect(queryKeys.bookings.list()).toEqual(["bookings"]);
    });

    it("list(tab) includes the tab", () => {
      expect(queryKeys.bookings.list("pending")).toEqual(["bookings", "pending"]);
      expect(queryKeys.bookings.list("all")).toEqual(["bookings", "all"]);
    });

    it("detail(id) matches the shape used for single-booking caches", () => {
      expect(queryKeys.bookings.detail("booking-1")).toEqual(["booking", "booking-1"]);
    });
  });

  describe("workspaces", () => {
    it("all is a stable base key", () => {
      expect(queryKeys.workspaces.all).toEqual(["workspaces"]);
    });

    it("list(params) nests the filter object", () => {
      expect(queryKeys.workspaces.list({ search: "lagos" })).toEqual([
        "workspaces",
        { search: "lagos" },
      ]);
    });

    it("list() with no params still returns a stable, prefixed key", () => {
      expect(queryKeys.workspaces.list()).toEqual(["workspaces", undefined]);
    });

    it("availability(workspaceId, date) matches the per-day query key shape", () => {
      expect(queryKeys.workspaces.availability("ws-1", "2026-08-22")).toEqual([
        "workspaces",
        "ws-1",
        "availability",
        "2026-08-22",
      ]);
    });
  });

  describe("newsletter", () => {
    it("preferences(token) matches the shape used across get/update/unsubscribe hooks", () => {
      expect(queryKeys.newsletter.preferences("tok-1")).toEqual([
        "newsletter",
        "preferences",
        "tok-1",
      ]);
    });

    it("preferences(null) is still a valid, distinct key", () => {
      expect(queryKeys.newsletter.preferences(null)).toEqual(["newsletter", "preferences", null]);
    });

    it("unsubscribe(token) is namespaced separately from preferences", () => {
      expect(queryKeys.newsletter.unsubscribe("tok-1")).toEqual(["newsletter", "unsubscribe", "tok-1"]);
    });
  });
});
