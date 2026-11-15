import { getBookingsLog } from "@/actions/booking-actions";
import { BookingsView } from "@/components/bookings/bookings-view";


export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const data = await getBookingsLog();

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
          Stays & Bookings Log
        </h1>
        <p className="text-xs text-muted-foreground">
          Real-time logs for walk-ins, phone reservations, Room 103 monthly stays, and completed check-outs.
        </p>
      </div>

      <BookingsView
        activeStays={data.activeStays as any}
        upcomingStays={data.upcomingStays as any}
        monthlyStays={data.monthlyStays as any}
        pastStays={data.pastStays as any}
      />
    </div>
  );
}
