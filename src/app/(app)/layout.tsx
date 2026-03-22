import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <div className="lg:pl-60">
        <main className="min-h-screen p-6 lg:p-8">
          {children}
        </main>
      </div>
    </>
  );
}
