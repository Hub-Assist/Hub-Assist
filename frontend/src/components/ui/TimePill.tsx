"use client";

import { useEffect, useState } from "react";

function elapsed(since: string) {
  const secs = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimePill({ since }: { since: string }) {
  const [display, setDisplay] = useState(() => elapsed(since));

  useEffect(() => {
    const id = setInterval(() => setDisplay(elapsed(since)), 1000);
    return () => clearInterval(id);
  }, [since]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D5DCBA] px-3 py-1 text-sm font-mono font-semibold text-[#1A1A1A]">
      🕐 {display}
    </span>
  );
}
