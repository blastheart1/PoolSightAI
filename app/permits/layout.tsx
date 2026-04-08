import PermitsSidebar from "@/components/permits/PermitsSidebar";

export const metadata = {
  title: "Permit Tools — PoolSightAI",
};

export default function PermitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <PermitsSidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
