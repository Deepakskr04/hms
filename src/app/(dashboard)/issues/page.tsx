import { prisma } from "@/lib/prisma";
import { getHotelIssues } from "@/actions/finance-and-issues-actions";
import { IssuesView } from "@/components/issues/issues-view";


export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const issuesRes = await getHotelIssues();
  const rooms = await prisma.room.findMany({
    orderBy: { roomNumber: "asc" },
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
          Maintenance & Issues Tracker
        </h1>
        <p className="text-xs text-muted-foreground">
          Track property issues, maintenance flags, and automatically link repair expenses upon resolution.
        </p>
      </div>

      <IssuesView initialIssues={issuesRes.issues as any} rooms={rooms} />
    </div>
  );
}
