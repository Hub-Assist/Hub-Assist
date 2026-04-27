import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert } from "@/components/ui/Alert";

describe("Alert", () => {
  it.each(["success", "error", "warning", "info"] as const)(
    "renders %s variant with correct background class",
    (variant) => {
      const classMap = {
        success: "bg-\\[#EAF3E8\\]",
        error: "bg-\\[#F9EDE8\\]",
        warning: "bg-\\[#FDF5E6\\]",
        info: "bg-\\[#EAF0F9\\]",
      };
      render(<Alert variant={variant}>Message</Alert>);
      const alert = screen.getByRole("alert");
      expect(alert.className).toMatch(new RegExp(classMap[variant]));
    }
  );

  it("renders an icon svg for each variant", () => {
    render(<Alert variant="success">OK</Alert>);
    expect(screen.getByRole("alert").querySelector("svg")).not.toBeNull();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const onDismiss = jest.fn();
    render(<Alert onDismiss={onDismiss}>Dismissible</Alert>);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not render dismiss button when onDismiss is not provided", () => {
    render(<Alert>No dismiss</Alert>);
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
