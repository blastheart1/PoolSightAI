"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TOOLS = [
  { href: "/permits", label: "Dashboard", icon: "🏠" },
  { href: "/permits/drawing-analyzer", label: "Drawing Analyzer", icon: "📐" },
  { href: "/permits/zoning-lookup", label: "Zoning Lookup", icon: "🗺️" },
  { href: "/permits/lot-calculator", label: "Lot Calculator", icon: "📏" },
  { href: "/permits/checklist-generator", label: "Checklist Generator", icon: "✅" },
  { href: "/permits/site-plan-generator", label: "Site Plan Generator", icon: "✏️" },
  { href: "/permits/pdf-assembler", label: "PDF Assembler", icon: "📄" },
  { href: "/permits/redline-drafter", label: "Redline Drafter", icon: "🔴" },
] as const;

export default function PermitsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      {/* Branding */}
      <div className="border-b border-slate-800 px-5 py-4">
        <img
          src="/Calimingo.png"
          alt="Calimingo"
          className="h-8 w-8 rounded-lg object-contain"
        />
        <h1 className="mt-2 text-sm font-extrabold tracking-tight text-white">
          Pool<span className="text-sky-400">Sight</span>AI
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Permit Tools
        </p>
      </div>

      {/* Back link */}
      <div className="border-b border-slate-800 px-1 py-2">
        <Link
          href="/"
          className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-[13px] font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          ← Back to PoolSightAI
        </Link>
      </div>

      {/* Tool nav */}
      <div className="flex-1 space-y-0.5 px-1 py-3">
        {TOOLS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                "flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-900"
              )}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>

      <footer className="border-t border-slate-800 px-5 py-3 text-[11px] text-slate-500">
        March 2026 · Confidential
      </footer>
    </nav>
  );
}
