import { ReactNode } from "react";

interface ResultCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function ResultCard({
  title,
  children,
  className,
}: ResultCardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 p-6 ${className ?? ""}`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          AI-generated
        </span>
      </div>
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      <div className="text-sm text-slate-300">{children}</div>
    </div>
  );
}
