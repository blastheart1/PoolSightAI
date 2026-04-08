import type { ConfidenceLevel } from "@/types/permits";
import clsx from "clsx";

const CONFIG: Record<ConfidenceLevel, { label: string; className: string }> = {
  high: {
    label: "High",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  medium: {
    label: "Medium",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  low: {
    label: "Low",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  className?: string;
}

export default function ConfidenceBadge({ level, className }: ConfidenceBadgeProps) {
  const cfg = CONFIG[level];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.className,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
