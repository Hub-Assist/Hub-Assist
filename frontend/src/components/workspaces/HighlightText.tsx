import React from "react";

interface HighlightTextProps {
  /** The full text to display */
  text: string;
  /** The search query to highlight within the text */
  query: string;
  /** Optional className applied to the wrapping <span> */
  className?: string;
  /** Optional className applied to each <mark> element */
  markClassName?: string;
}

/**
 * Renders `text` with every occurrence of `query` (case-insensitive) wrapped
 * in a `<mark>` element so the match is visually highlighted.
 *
 * If `query` is empty, fewer than 2 characters, or not found, the text is
 * rendered as-is.
 */
export function HighlightText({
  text,
  query,
  className,
  markClassName = "bg-yellow-200 text-yellow-900 rounded px-0.5",
}: HighlightTextProps) {
  // Only highlight when the query meets the 2-character minimum
  if (!query || query.trim().length < 2) {
    return <span className={className}>{text}</span>;
  }

  const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className={markClassName}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}
