import { type HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Additional Tailwind classes for sizing, rounding, etc.
   * Defaults give a standard pill shape; override as needed.
   */
  className?: string;
}

/**
 * Low-level skeleton primitive.
 *
 * - aria-hidden="true"  → screen readers skip the placeholder entirely.
 * - animate-pulse       → CSS-only shimmer, no JS timers.
 * - Consumers control dimensions via `className`.
 *
 * @example
 * // A full-width bar, 16px tall
 * <Skeleton className="h-4 w-full rounded-md" />
 */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-[#EDE2D6] rounded-xl ${className}`.trim()}
      {...props}
    />
  );
}
