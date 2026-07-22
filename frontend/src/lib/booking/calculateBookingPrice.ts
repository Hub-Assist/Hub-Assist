export function calculateBookingPrice(
  pricePerHour: number,
  startTime: string,
  endTime: string
): number {
  if (!startTime || !endTime) return 0;
  const start = new Date(startTime);
  const end = new Date(endTime);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, hours * pricePerHour);
}
