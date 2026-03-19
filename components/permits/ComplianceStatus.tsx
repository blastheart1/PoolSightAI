import type { ComplianceStatus as ComplianceStatusType } from "@/types/permits";
import clsx from "clsx";

const CONFIG: Record<ComplianceStatusType, { label: string; color: string; icon: string }> = {
  pass: { label: "Pass", color: "bg-emerald-900/50 text-emerald-400 border-emerald-800", icon: "✓" },
  fail: { label: "Fail", color: "bg-red-900/50 text-red-400 border-red-800", icon: "✗" },
  warning: { label: "Warning", color: "bg-amber-900/50 text-amber-400 border-amber-800", icon: "!" },
};

interface ComplianceStatusProps {
  status: ComplianceStatusType;
  className?: string;
}

export default function ComplianceStatus({
  status,
  className,
}: ComplianceStatusProps) {
  const cfg = CONFIG[status];
  return (
    <span
      className={clsx(
        "inline-flex min-w-[76px] items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        cfg.color,
        className
      )}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
