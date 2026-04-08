"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5c0-2.485-2.015-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconRuler() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="5" width="13" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="5" x2="4" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="5" x2="7" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="5" x2="13" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChecklist() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5.5L9.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 2v3.5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="5.5" y1="9" x2="10.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5.5" y1="11.5" x2="8.5" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOOLS = [
  { href: "/permits", label: "Dashboard", Icon: IconGrid },
  { href: "/permits/zoning-lookup", label: "Zoning Lookup", Icon: IconMap },
  { href: "/permits/lot-calculator", label: "Lot Calculator", Icon: IconRuler },
  { href: "/permits/checklist-generator", label: "Checklist", Icon: IconChecklist },
  { href: "/permits/redline-drafter", label: "Redline Drafter", Icon: IconEdit },
  { href: "/permits/pdf-assembler", label: "PDF Assembler", Icon: IconFile },
] as const;

export default function PermitsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Branding */}
      <div className="border-b border-slate-200 px-5 py-4">
        <img
          src="/Calimingo.png"
          alt="Calimingo"
          className="h-8 w-8 rounded-lg object-contain"
        />
        <h1 className="mt-2 text-sm font-bold tracking-tight text-slate-900">
          Pool<span className="text-blue-600">Sight</span>AI
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-500">Permit Tools</p>
      </div>

      {/* Back link */}
      <div className="border-b border-slate-200 px-2 py-2">
        <Link
          href="/"
          className="flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <IconChevronLeft />
          Back to PoolSightAI
        </Link>
      </div>

      {/* Tool nav */}
      <div className="flex-1 space-y-0.5 px-2 py-3">
        {TOOLS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className={clsx("shrink-0", active ? "text-blue-600" : "text-slate-400")}>
                <Icon />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      <footer className="border-t border-slate-200 px-5 py-3 text-[11px] text-slate-400">
        2026 · Confidential
      </footer>
    </nav>
  );
}
