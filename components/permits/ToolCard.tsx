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
      className="group relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span className="text-3xl" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-700">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-slate-500">{description}</p>
      {phase && (
        <span className="mt-auto self-start rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          {phase}
        </span>
      )}
    </Link>
  );
}
