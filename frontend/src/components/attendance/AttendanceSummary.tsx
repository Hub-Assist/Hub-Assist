import type { AttendanceRecord } from "@/lib/api";

interface Props {
  records: AttendanceRecord[];
}

export function AttendanceSummary({ records }: Props) {
  const totalMins = records.reduce((acc, r) => {
    if (!r.clockOut) return acc;
    return acc + Math.round(
      (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 60000
    );
  }, 0);

  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const sessions = records.length;

  return (
    <div className="flex gap-4">
      {[
        { label: "Sessions Today", value: String(sessions) },
        { label: "Total Time", value: totalMins > 0 ? `${h}h ${m}m` : "—" },
      ].map(({ label, value }) => (
        <div key={label} className="flex-1 rounded-2xl bg-[#F3EBE2] border border-[#D7CFC6] px-5 py-4">
          <p className="text-xs text-[#6B6B6B] font-semibold tracking-wide uppercase">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1A1A]">{value}</p>
        </div>
      ))}
    </div>
  );
}
