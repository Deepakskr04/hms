import { getGuestsDirectory } from "@/actions/booking-actions";
import { GuestsView } from "@/components/guests/guests-view";


export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const data = await getGuestsDirectory();

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
          Guest Directory & ID Vault
        </h1>
        <p className="text-xs text-muted-foreground">
          Guest profiles, repeat stay history, and compressed government ID photos.
        </p>
      </div>

      <GuestsView initialGuests={data.guests as any} />
    </div>
  );
}
