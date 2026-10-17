"use client";

interface LiveIndicatorProps {
  label?: string;
  className?: string;
  showText?: boolean;
}

export default function LiveIndicator({
  label = "Live Sync",
  className = "",
  showText = true,
}: LiveIndicatorProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs backdrop-blur-xs select-none ${className}`}
      title="Connected to Supabase Realtime - Changes update automatically without refreshing"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      {showText && <span>{label}</span>}
    </div>
  );
}
