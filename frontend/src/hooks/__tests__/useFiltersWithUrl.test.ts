import { act, renderHook } from "@testing-library/react";
import { useFiltersWithUrl, type FilterSchema } from "@/hooks/useFiltersWithUrl";
import { booleanCodec, enumCodec } from "@/lib/filters/codecs";

const replace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/workspaces",
  useSearchParams: () => mockSearchParams,
}));

interface TestFilters {
  type?: "office" | "desk";
  availability?: boolean;
}

const DEFAULT_FILTERS: TestFilters = {};

const SCHEMA: FilterSchema<TestFilters> = {
  type: enumCodec(["office", "desk"]),
  availability: booleanCodec(),
};

describe("useFiltersWithUrl", () => {
  beforeEach(() => {
    replace.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  it("initializes filters from valid URL search params", () => {
    mockSearchParams = new URLSearchParams("type=desk&availability=true");

    const { result } = renderHook(() => useFiltersWithUrl(DEFAULT_FILTERS, SCHEMA));

    expect(result.current[0]).toEqual({ type: "desk", availability: true });
  });

  it("falls back to defaults when a URL param value is invalid", () => {
    mockSearchParams = new URLSearchParams("type=InvalidType");

    const { result } = renderHook(() => useFiltersWithUrl(DEFAULT_FILTERS, SCHEMA));

    expect(result.current[0]).toEqual(DEFAULT_FILTERS);
  });

  it("restores filters after browser back/forward changes the search params", () => {
    mockSearchParams = new URLSearchParams("type=desk");
    const { result, rerender } = renderHook(() => useFiltersWithUrl(DEFAULT_FILTERS, SCHEMA));
    expect(result.current[0]).toEqual({ type: "desk" });

    mockSearchParams = new URLSearchParams("type=office");
    rerender();
    expect(result.current[0]).toEqual({ type: "office" });
  });

  it("updates the URL via router.replace (not push) when filters change", () => {
    const { result } = renderHook(() => useFiltersWithUrl(DEFAULT_FILTERS, SCHEMA));

    act(() => {
      result.current[1]({ type: "office", availability: true });
    });

    expect(replace).toHaveBeenCalledWith("/workspaces?type=office&availability=true", { scroll: false });
  });

  it("omits params that match the defaults, keeping the URL clean", () => {
    const { result } = renderHook(() => useFiltersWithUrl(DEFAULT_FILTERS, SCHEMA));

    act(() => {
      result.current[1]({});
    });

    expect(replace).toHaveBeenCalledWith("/workspaces", { scroll: false });
  });
});
