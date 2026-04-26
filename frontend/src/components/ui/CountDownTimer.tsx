"use client";

import { useEffect, useState } from "react";

interface CountDownTimerProps {
  seconds: number;
  onExpire: () => void;
}

export function CountDownTimer({ seconds, onExpire }: Readonly<CountDownTimerProps>) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, onExpire]);

  return <span className="tabular-nums text-[#6B6B6B]">{remaining}s</span>;
}
