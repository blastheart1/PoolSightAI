import { ReactNode } from "react";

interface ResultCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function ResultCard({ title, children, className }: ResultCardProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          AI-generated
        </span>
      </div>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
