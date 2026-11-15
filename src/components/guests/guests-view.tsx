"use client";

import { useState } from "react";
import { Guest, Booking, Room } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Phone,
  User,
  ShieldCheck,
} from "lucide-react";

type GuestWithBookings = Guest & {
  bookings: (Booking & { room: Room })[];
};

interface GuestsViewProps {
  initialGuests: GuestWithBookings[];
}

export function GuestsView({ initialGuests }: GuestsViewProps) {
  const [search, setSearch] = useState("");
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const filteredGuests = initialGuests.filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      g.fullName.toLowerCase().includes(q) ||
      g.phone.includes(q) ||
      (g.idProofNo && g.idProofNo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by phone number, guest name, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 text-xs sm:text-sm"
        />
      </div>

      {/* Guest Cards / Vault List */}
      {filteredGuests.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground space-y-2">
          <User className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium">No guests found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGuests.map((guest) => {
            const visitCount = guest.bookings.length;
            const pastRooms = Array.from(
              new Set(guest.bookings.map((b) => b.room.roomNumber))
            );

            return (
              <div
                key={guest.id}
                className="bg-card border rounded-xl p-4 shadow-xs space-y-3 flex flex-col justify-between hover:border-primary/40 transition-colors"
              >
                <div className="space-y-2">
                  {/* Top Bar: Name & Visit Count */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-foreground leading-tight">
                        {guest.fullName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3 text-primary" />
                        <span className="font-mono">{guest.phone}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-semibold shrink-0">
                      {visitCount} {visitCount === 1 ? "Stay" : "Stays"}
                    </Badge>
                  </div>

                  {/* ID Details */}
                  <div className="bg-muted/40 rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1 text-[11px] font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        {guest.idProofType}
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {guest.idProofNo}
                      </span>
                    </div>

                    {/* Rooms stayed in */}
                    {pastRooms.length > 0 && (
                      <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <span>Past Rooms: </span>
                        <span className="font-semibold text-foreground">
                          {pastRooms.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ID Photo Vault Previews */}
                <div className="pt-2 border-t space-y-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    ID Photos (Local Vault)
                  </span>

                  {guest.idFrontUrl || guest.idBackUrl ? (
                    <div className="grid grid-cols-2 gap-2">
                      {guest.idFrontUrl && (
                        <div
                          onClick={() =>
                            setSelectedImage({
                              url: guest.idFrontUrl!,
                              title: `${guest.fullName} - ID Front`,
                            })
                          }
                          className="border rounded-md p-1 bg-background cursor-pointer hover:border-primary transition-colors text-center"
                        >
                          <img
                            src={guest.idFrontUrl}
                            alt="Front"
                            className="h-16 w-full object-cover rounded"
                          />
                          <span className="text-[9px] text-muted-foreground mt-0.5 block">
                            Front Photo
                          </span>
                        </div>
                      )}

                      {guest.idBackUrl && (
                        <div
                          onClick={() =>
                            setSelectedImage({
                              url: guest.idBackUrl!,
                              title: `${guest.fullName} - ID Back`,
                            })
                          }
                          className="border rounded-md p-1 bg-background cursor-pointer hover:border-primary transition-colors text-center"
                        >
                          <img
                            src={guest.idBackUrl}
                            alt="Back"
                            className="h-16 w-full object-cover rounded"
                          />
                          <span className="text-[9px] text-muted-foreground mt-0.5 block">
                            Back Photo
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      No photos uploaded for this guest.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ID Photo Zoom Modal */}
      <Dialog
        open={Boolean(selectedImage)}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      >
        <DialogContent className="max-w-xl p-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {selectedImage?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="p-2 bg-muted/20 rounded-lg flex items-center justify-center">
              <img
                src={selectedImage.url}
                alt="Enlarged ID Preview"
                className="max-h-[75vh] w-auto max-w-full rounded shadow"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
