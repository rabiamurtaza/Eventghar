"use client";

/**
 * Shows a warning when "Overall Event Capacity" doesn't match the sum of the
 * ticket types' "Total Available", so admins know which number actually limits sales.
 */
export default function CapacityMismatchHint({
  totalTickets,
  tiers,
}: {
  totalTickets: string;
  tiers: Array<{ name?: string; total?: string | number }>;
}) {
  const overall = Number(totalTickets) > 0 ? Number(totalTickets) : null;
  const filled = tiers.filter((t) => t.name || t.total);
  const allHaveLimits = filled.length > 0 && filled.every((t) => Number(t.total) > 0);
  const tierSum = allHaveLimits ? filled.reduce((s, t) => s + Number(t.total), 0) : null;

  if (overall === null || tierSum === null || overall === tierSum) return null;

  return (
    <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      ⚠️ Ticket types add up to <strong>{tierSum}</strong> but Overall Event Capacity is <strong>{overall}</strong>.
      The real limit is the smaller number (<strong>{Math.min(overall, tierSum)}</strong>). Update one of them if that is not what you want.
    </p>
  );
}
