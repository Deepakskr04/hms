import { getCurrentRole } from "@/lib/auth";
import { Sidebar, MobileHeader, MobileBottomNav } from "@/components/navigation";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getCurrentRole();

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Desktop Sidebar */}
      <Sidebar role={role} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        <MobileHeader role={role} />

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav />
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
