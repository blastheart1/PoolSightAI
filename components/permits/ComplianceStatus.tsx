import type { ComplianceStatus as ComplianceStatusType } from "@/types/permits";
import clsx from "clsx";

const CONFIG: Record<ComplianceStatusType, { label: string; className: string }> = {
  pass: {
    label: "Pass",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  fail: {
    label: "Fail",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  warning: {
    label: "Warning",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

interface ComplianceStatusProps {
  status: ComplianceStatusType;
  className?: string;
}

export default function ComplianceStatus({ status, className }: ComplianceStatusProps) {
  const cfg = CONFIG[status];
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
