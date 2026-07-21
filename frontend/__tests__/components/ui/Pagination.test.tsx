import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "@/components/ui/Pagination";

describe("Pagination", () => {
  const setup = (page: number, totalPages: number, onPageChange = jest.fn()) =>
    render(<Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />);

  it("renders correct page number buttons", () => {
    setup(1, 3);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("calls onPageChange with correct page when a page button is clicked", async () => {
    const onPageChange = jest.fn();
    setup(1, 3, onPageChange);
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables prev button on first page", () => {
    setup(1, 3);
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
  });

  it("disables next button on last page", () => {
    setup(3, 3);
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("calls onPageChange(page-1) when prev is clicked", async () => {
    const onPageChange = jest.fn();
    setup(2, 3, onPageChange);
    await userEvent.click(screen.getByRole("button", { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange(page+1) when next is clicked", async () => {
    const onPageChange = jest.fn();
    setup(2, 3, onPageChange);
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
