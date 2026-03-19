import Link from "next/link";

interface ToolCardProps {
  href: string;
  icon: string;
  title: string;
  description: string;
  phase?: string;
}

export default function ToolCard({
  href,
  icon,
  title,
  description,
  phase,
}: ToolCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6 transition-all hover:border-sky-700 hover:bg-slate-900"
    >
      <span className="text-3xl" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-white group-hover:text-sky-400">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-slate-400">{description}</p>
      {phase && (
        <span className="mt-auto self-start rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400">
          {phase}
        </span>
      )}
    </Link>
  );
}
