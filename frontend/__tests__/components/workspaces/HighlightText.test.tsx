import React from "react";
import { render, screen } from "@testing-library/react";
import { HighlightText } from "@/components/workspaces/HighlightText";

describe("HighlightText", () => {
  it("renders the full text as-is when query is empty", () => {
    render(<HighlightText text="Open Office Space" query="" />);
    expect(screen.getByText("Open Office Space")).toBeInTheDocument();
    expect(document.querySelector("mark")).toBeNull();
  });

  it("renders the full text as-is when query is a single character", () => {
    render(<HighlightText text="Open Office Space" query="O" />);
    // No <mark> should appear — single char below 2-char minimum
    expect(document.querySelector("mark")).toBeNull();
  });

  it("wraps matched substring in a <mark> element", () => {
    const { container } = render(<HighlightText text="Open Office Space" query="Office" />);
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("Office");
  });

  it("is case-insensitive when matching", () => {
    const { container } = render(<HighlightText text="Open Office Space" query="office" />);
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("Office");
  });

  it("highlights multiple occurrences", () => {
    const { container } = render(
      <HighlightText text="desk next to a bigger desk" query="desk" />
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    marks.forEach((m) => expect(m.textContent).toBe("desk"));
  });

  it("preserves non-matching portions of the text outside <mark>", () => {
    const { container } = render(
      <HighlightText text="Conference Room A" query="Room" />
    );
    // Total text content should remain the same
    expect(container.textContent).toBe("Conference Room A");
    expect(container.querySelector("mark")?.textContent).toBe("Room");
  });

  it("does not highlight when query is not found in text", () => {
    render(<HighlightText text="Meeting Room" query="xyz" />);
    expect(document.querySelector("mark")).toBeNull();
    expect(screen.getByText("Meeting Room")).toBeInTheDocument();
  });

  it("applies the default mark class", () => {
    const { container } = render(<HighlightText text="Private Office" query="Office" />);
    const mark = container.querySelector("mark");
    expect(mark?.className).toMatch(/bg-yellow-200/);
  });

  it("applies a custom markClassName when provided", () => {
    const { container } = render(
      <HighlightText text="Private Office" query="Office" markClassName="custom-highlight" />
    );
    const mark = container.querySelector("mark");
    expect(mark?.className).toBe("custom-highlight");
  });

  it("applies className to the wrapping <span>", () => {
    const { container } = render(
      <HighlightText text="Hot Desk" query="Desk" className="wrapper-class" />
    );
    const span = container.querySelector("span");
    expect(span?.className).toBe("wrapper-class");
  });

  it("renders the full text with no marks when query is whitespace only", () => {
    render(<HighlightText text="Conference Room" query="   " />);
    expect(document.querySelector("mark")).toBeNull();
  });

  it("handles special regex characters in the query safely", () => {
    const { container } = render(
      <HighlightText text="Office (A)" query="(" />
    );
    // Single char — no highlight expected
    expect(document.querySelector("mark")).toBeNull();

    // Two-char query that includes a special regex character
    const { container: c2 } = render(
      <HighlightText text="Office (A)" query="(A" />
    );
    const mark = c2.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("(A");
  });
});
