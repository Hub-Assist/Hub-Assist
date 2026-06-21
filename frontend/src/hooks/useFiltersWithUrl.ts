"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterCodec } from "@/lib/filters/codecs";

export type FilterSchema<F> = {
  [K in keyof F]-?: FilterCodec<NonNullable<F[K]>>;
};

/**
 * Synchronizes a filters object with URL search params using `router.replace`
 * so filter changes don't pollute browser history. Invalid or missing params
 * fall back to `defaultFilters`.
 */
export function useFiltersWithUrl<F extends object>(
  defaultFilters: F,
  schema: FilterSchema<F>
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaultFilters };
    (Object.keys(schema) as (keyof F)[]).forEach((key) => {
      const raw = searchParams.get(key as string);
      if (raw === null || raw === "") return;
      const parsed = schema[key].parse(raw);
      if (parsed !== undefined) {
        result[key] = parsed as F[typeof key];
      }
    });
    return result;
  }, [searchParams, schema, defaultFilters]);

  const setFilters = useCallback(
    (next: F) => {
      const params = new URLSearchParams();
      (Object.keys(schema) as (keyof F)[]).forEach((key) => {
        const value = next[key];
        const isDefault = value === undefined || value === defaultFilters[key];
        if (!isDefault) {
          params.set(key as string, schema[key].serialize(value as NonNullable<F[typeof key]>));
        }
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [defaultFilters, pathname, router, schema]
  );

  return [filters, setFilters] as const;
}
