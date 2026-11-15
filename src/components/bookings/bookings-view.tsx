"use client";

import { useState } from "react";
import { Booking, Guest, Room, BookingPayment } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkOutBooking, extendBookingStay } from "@/actions/booking-actions";
import { calculateStayUnitsAndBill } from "@/lib/booking-utils";
import { toast } from "sonner";
import {
  CalendarDays,
  Phone,
  User,
  LogOut,
  CalendarPlus,
  Clock,
} from "lucide-react";

type BookingWithRelations = Booking & {
  guest: Guest;
  room: Room;
  payments?: BookingPayment[];
};

interface BookingsViewProps {
  activeStays: BookingWithRelations[];
  upcomingStays: BookingWithRelations[];
  monthlyStays: BookingWithRelations[];
  pastStays: BookingWithRelations[];
}

export function BookingsView({
  activeStays,
  upcomingStays,
  monthlyStays,
  pastStays,
}: BookingsViewProps) {
  const [activeTab, setActiveTab] = useState<
    "ACTIVE" | "UPCOMING" | "MONTHLY" | "PAST"
  >("ACTIVE");

  const getList = () => {
    switch (activeTab) {
      case "ACTIVE":
        return activeStays;
      case "UPCOMING":
        return upcomingStays;
      case "MONTHLY":
        return monthlyStays;
      case "PAST":
        return pastStays;
    }
  };

  const currentList = getList();

  const handleCheckOut = async (bookingId: string, roomNumber: string) => {
    const confirm = window.confirm(`Check out Room ${roomNumber}?`);
    if (!confirm) return;

    const res = await checkOutBooking(bookingId);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.error || "Failed to check out");
    }
  };

  const handleQuickExtend = async (booking: BookingWithRelations) => {
    const confirm = window.confirm(
      `Extend stay for ${booking.guest.fullName} (Room ${booking.room.roomNumber}) by 1 day?`
    );
    if (!confirm) return;

    const res = await extendBookingStay({
      bookingId: booking.id,
      additionalDays: 1,
    });

    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.error || "Failed to extend stay");
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex border-b text-xs sm:text-sm font-semibold gap-2 sm:gap-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("ACTIVE")}
          className={`pb-2 px-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "ACTIVE"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Active Daily Stays</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {activeStays.length}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("UPCOMING")}
          className={`pb-2 px-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "UPCOMING"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Upcoming Reservations</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {upcomingStays.length}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("MONTHLY")}
          className={`pb-2 px-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "MONTHLY"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Monthly Tenants</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {monthlyStays.length}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("PAST")}
          className={`pb-2 px-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "PAST"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Past Check-Outs</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {pastStays.length}
          </Badge>
        </button>
      </div>

      {/* Bookings List */}
      {currentList.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground space-y-2">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium">No records in this category.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentList.map((booking) => {
            const metrics = calculateStayUnitsAndBill(booking, new Date());

            return (
              <div
                key={booking.id}
                className="bg-card border rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors"
              >
                {/* Left Column: Room & Guest */}
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-muted-foreground leading-none">
                      ROOM
                    </span>
                    <span className="text-base font-black text-primary leading-tight">
                      {booking.room.roomNumber}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-primary" />
                        {booking.guest.fullName}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {booking.source}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {booking.stayType}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${
                          booking.status === "ACTIVE"
                            ? "bg-rose-600 text-white"
                            : booking.status === "UPCOMING"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-600 text-white"
                        }`}
                      >
                        {booking.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {booking.guest.phone}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        In: {new Date(booking.checkIn).toLocaleDateString()} (12 PM)
                        {" → "}
                        {booking.expectedCheckOut
                          ? `Out: ${new Date(booking.expectedCheckOut).toLocaleDateString()} (12 PM)`
                          : "Open-Ended"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Financials & Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-semibold text-foreground">
                      ₹{booking.agreedRate} / {booking.stayType === "DAILY" ? "day" : "month"}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      Paid: ₹{booking.totalPaid} • Accrued: ₹{metrics.calculatedTotal}
                    </div>
                  </div>

                  {booking.status === "ACTIVE" && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickExtend(booking)}
                        className="text-xs h-8"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                        +1 Day
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCheckOut(booking.id, booking.room.roomNumber)}
                        className="text-xs h-8 font-semibold"
                      >
                        <LogOut className="h-3.5 w-3.5 mr-1" />
                        Check Out
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
