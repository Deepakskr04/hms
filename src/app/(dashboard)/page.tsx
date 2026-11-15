import { getDashboardData } from "@/actions/booking-actions";
import { LiveBoard } from "@/components/dashboard/live-board";


export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            At-a-Glance Live Board
          </h1>
          <p className="text-xs text-muted-foreground">
            Real-time occupancy, 12:00 PM check-out cycles, and room status.
          </p>
        </div>
      </div>

      <LiveBoard rooms={data.rooms as any} kpis={data.kpis} />
    </div>
  );
}
