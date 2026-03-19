import type { ConfidenceLevel } from "@/types/permits";
import clsx from "clsx";

const CONFIG: Record<ConfidenceLevel, { label: string; color: string }> = {
  high: { label: "High", color: "bg-emerald-900/50 text-emerald-400 border-emerald-800" },
  medium: { label: "Medium", color: "bg-amber-900/50 text-amber-400 border-amber-800" },
  low: { label: "Low", color: "bg-red-900/50 text-red-400 border-red-800" },
};

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  className?: string;
}

export default function ConfidenceBadge({
  level,
  className,
}: ConfidenceBadgeProps) {
  const cfg = CONFIG[level];
  return (
    <span
      className={clsx(
        "inline-flex min-w-[60px] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide",
        cfg.color,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
