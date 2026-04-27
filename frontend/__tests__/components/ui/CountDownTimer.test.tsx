import React from "react";
import { render, screen, act } from "@testing-library/react";
import { CountDownTimer } from "@/components/ui/CountDownTimer";

describe("CountDownTimer", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("renders initial seconds", () => {
    render(<CountDownTimer seconds={60} onExpire={jest.fn()} />);
    expect(screen.getByText("60s")).toBeInTheDocument();
  });

  it("counts down every second", () => {
    render(<CountDownTimer seconds={60} onExpire={jest.fn()} />);
    // Component uses chained setTimeout(1000); run all pending timers 3 times
    act(() => { jest.advanceTimersByTime(1000); });
    act(() => { jest.advanceTimersByTime(1000); });
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText("57s")).toBeInTheDocument();
  });

  it("calls onExpire when reaching 0", () => {
    const onExpire = jest.fn();
    render(<CountDownTimer seconds={3} onExpire={onExpire} />);
    act(() => { jest.advanceTimersByTime(1000); }); // 2
    act(() => { jest.advanceTimersByTime(1000); }); // 1
    act(() => { jest.advanceTimersByTime(1000); }); // 0 → onExpire
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("re-renders every second", () => {
    render(<CountDownTimer seconds={5} onExpire={jest.fn()} />);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText("4s")).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText("3s")).toBeInTheDocument();
  });
});
