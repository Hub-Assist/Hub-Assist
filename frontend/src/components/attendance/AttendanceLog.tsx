import type { AttendanceRecord } from "@/lib/api";

function duration(record: AttendanceRecord) {
  if (!record.clockOut) return "Active";
  const mins = Math.round(
    (new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 60000
  );
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  records: AttendanceRecord[];
  showMember?: boolean;
}

export function AttendanceLog({ records, showMember }: Props) {
  if (records.length === 0)
    return <p className="text-sm text-[#6B6B6B]">No attendance records for today.</p>;

  return (
    <div className="rounded-2xl border border-[#D7CFC6] bg-[#F3EBE2] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#D7CFC6] text-xs text-[#6B6B6B]">
            {showMember && <th className="px-4 py-2.5 text-left font-semibold">Member</th>}
            <th className="px-4 py-2.5 text-left font-semibold">Clock In</th>
            <th className="px-4 py-2.5 text-left font-semibold">Clock Out</th>
            <th className="px-4 py-2.5 text-left font-semibold">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#D7CFC6]">
          {records.map((r) => (
            <tr key={r.id}>
              {showMember && (
                <td className="px-4 py-2.5 text-[#1A1A1A]">{r.memberName ?? "—"}</td>
              )}
              <td className="px-4 py-2.5 text-[#1A1A1A]">
                {new Date(r.clockIn).toLocaleTimeString()}
              </td>
              <td className="px-4 py-2.5 text-[#6B6B6B]">
                {r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : "—"}
              </td>
              <td className="px-4 py-2.5 font-medium text-[#1A1A1A]">{duration(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
