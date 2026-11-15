"use client";

import { useState } from "react";
import { Room, Booking, Guest, HotelIssue, BookingPayment } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { CheckInModal } from "./check-in-modal";
import { OccupiedModal } from "./occupied-modal";
import { markRoomCleaned } from "@/actions/room-actions";
import { calculateStayUnitsAndBill } from "@/lib/booking-utils";
import { toast } from "sonner";
import {
  Wind,
  Lock,
  User,
  IndianRupee,
  BedDouble,
  LogOut,
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  Wallet,
} from "lucide-react";

type RoomWithRelations = Room & {
  bookings: (Booking & { guest: Guest; payments?: BookingPayment[] })[];
  issues: HotelIssue[];
};

interface DashboardKPIs {
  occupiedCount: number;
  totalBookable: number;
  todayCheckoutsCount: number;
  grossRevenue: number;
  cashRevenue: number;
  upiRevenue: number;
  totalExpenses: number;
  netProfit: number;
  cashInHand: number;
  pendingRunningBalance: number;
  allStandardDailyOccupied: boolean;
}

interface LiveBoardProps {
  rooms: RoomWithRelations[];
  kpis: DashboardKPIs;
}

export function LiveBoard({ rooms, kpis }: LiveBoardProps) {
  // Modal states
  const [selectedForCheckIn, setSelectedForCheckIn] = useState<RoomWithRelations | null>(null);
  const [selectedForOccupied, setSelectedForOccupied] = useState<RoomWithRelations | null>(null);

  // Multi-toggle filter pills
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);
  const [filterAttachedBath, setFilterAttachedBath] = useState(false);
  const [filterAC, setFilterAC] = useState(false);
  const [filterFanCooler, setFilterFanCooler] = useState(false);
  const [filterBetterBed, setFilterBetterBed] = useState(false);
  const [filterDoubleBed, setFilterDoubleBed] = useState(false);
  const [filterTv, setFilterTv] = useState(false);
  const [filterKitchen, setFilterKitchen] = useState(false);

  const hasActiveFilters =
    filterAvailableOnly ||
    filterAttachedBath ||
    filterAC ||
    filterFanCooler ||
    filterBetterBed ||
    filterDoubleBed ||
    filterTv ||
    filterKitchen;

  const clearFilters = () => {
    setFilterAvailableOnly(false);
    setFilterAttachedBath(false);
    setFilterAC(false);
    setFilterFanCooler(false);
    setFilterBetterBed(false);
    setFilterDoubleBed(false);
    setFilterTv(false);
    setFilterKitchen(false);
  };

  // Filter evaluation
  const filteredRooms = rooms.filter((r) => {
    if (filterAvailableOnly && r.status !== "AVAILABLE") return false;
    if (filterAttachedBath && !r.isAttached) return false;
    if (filterAC && r.cooling !== "AC") return false;
    if (filterFanCooler && r.cooling !== "FAN_COOLER") return false;
    if (filterBetterBed && r.bedType !== "BETTER_BED") return false;
    if (filterDoubleBed && r.bedType !== "DOUBLE_BED") return false;
    if (filterTv && !r.hasTv) return false;
    if (filterKitchen && !r.hasKitchen) return false;
    return true;
  });

  // Group rooms into 3 wings
  const groundFloorRooms = filteredRooms.filter((r) => r.wing === "GROUND_FLOOR");
  const firstFloorRooms = filteredRooms.filter((r) => r.wing === "FIRST_FLOOR");
  const newSideRooms = filteredRooms.filter((r) => r.wing === "NEW_SIDE_1F");

  const handleRoomClick = async (room: RoomWithRelations) => {
    if (room.mode === "PERSONAL" || room.mode === "STORE_ROOM") {
      toast.info(`Room ${room.roomNumber} is locked (${room.mode}) and not for customer use.`);
      return;
    }

    if (room.status === "OCCUPIED") {
      setSelectedForOccupied(room);
    } else if (room.status === "AVAILABLE") {
      setSelectedForCheckIn(room);
    } else if (room.status === "NEEDS_CLEANING") {
      const confirmClean = window.confirm(
        `Mark Room ${room.roomNumber} as Cleaned & Available?`
      );
      if (confirmClean) {
        const res = await markRoomCleaned(room.id);
        if (res.success) toast.success(res.message);
        else toast.error(res.error || "Failed to update room");
      }
    } else if (room.status === "MAINTENANCE") {
      toast.warning(
        `Room ${room.roomNumber} is currently under MAINTENANCE. Resolve open issues on the Issues tab.`
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP KPI STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {/* Occupied */}
        <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Occupancy</span>
            <BedDouble className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight">
              {kpis.occupiedCount} <span className="text-sm font-normal text-muted-foreground">/ {kpis.totalBookable}</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Active daily & monthly
            </span>
          </div>
        </div>

        {/* Today's 12 PM Check-Outs */}
        <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Due Check-Outs</span>
            <LogOut className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {kpis.todayCheckoutsCount}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Fixed 12:00 PM due
            </span>
          </div>
        </div>

        {/* Month Cash Flow */}
        <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Month Revenue</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              ₹{kpis.grossRevenue.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Collected payments
            </span>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Month Expenses</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              ₹{kpis.totalExpenses.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Logged costs
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Net Profit</span>
            <IndianRupee className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
              ₹{kpis.netProfit.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Inflow minus costs
            </span>
          </div>
        </div>

        {/* Pending Running Balances */}
        <div className="bg-card border rounded-xl p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pending Dues</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              ₹{kpis.pendingRunningBalance.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Accrued active balances
            </span>
          </div>
        </div>
      </div>

      {/* 2. QUICK AMENITY FILTER BAR */}
      <div className="bg-card border rounded-xl p-3 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Quick Filters
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <X className="h-3 w-3" /> Clear Filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterPill
            label="Available Only"
            active={filterAvailableOnly}
            onClick={() => setFilterAvailableOnly(!filterAvailableOnly)}
          />
          <FilterPill
            label="Attached Bath"
            active={filterAttachedBath}
            onClick={() => setFilterAttachedBath(!filterAttachedBath)}
          />
          <FilterPill
            label="AC"
            active={filterAC}
            onClick={() => setFilterAC(!filterAC)}
          />
          <FilterPill
            label="Fan + Cooler"
            active={filterFanCooler}
            onClick={() => setFilterFanCooler(!filterFanCooler)}
          />
          <FilterPill
            label="Better Bed"
            active={filterBetterBed}
            onClick={() => setFilterBetterBed(!filterBetterBed)}
          />
          <FilterPill
            label="Double Bed"
            active={filterDoubleBed}
            onClick={() => setFilterDoubleBed(!filterDoubleBed)}
          />
          <FilterPill
            label="TV"
            active={filterTv}
            onClick={() => setFilterTv(!filterTv)}
          />
          <FilterPill
            label="Kitchen"
            active={filterKitchen}
            onClick={() => setFilterKitchen(!filterKitchen)}
          />
        </div>
      </div>

      {/* 3. 3-WING ROOM GRID */}
      <div className="space-y-6">
        {/* Ground Floor */}
        <WingSection
          title="Ground Floor"
          subtitle="6 Rooms (Standard, Kitchen Suite & Locked)"
          rooms={groundFloorRooms}
          onRoomClick={handleRoomClick}
          allStandardOccupied={kpis.allStandardDailyOccupied}
        />

        {/* 1st Floor */}
        <WingSection
          title="1st Floor"
          subtitle="8 Rooms (AC & Fan Rooms)"
          rooms={firstFloorRooms}
          onRoomClick={handleRoomClick}
          allStandardOccupied={kpis.allStandardDailyOccupied}
        />

        {/* New Side 1st Floor */}
        <WingSection
          title="New Side 1st Floor"
          subtitle="3 Rooms (Suites with Balcony / Kitchen)"
          rooms={newSideRooms}
          onRoomClick={handleRoomClick}
          allStandardOccupied={kpis.allStandardDailyOccupied}
        />
      </div>

      {/* Modals */}
      <CheckInModal
        room={selectedForCheckIn}
        isOpen={Boolean(selectedForCheckIn)}
        onClose={() => setSelectedForCheckIn(null)}
        allStandardOccupied={kpis.allStandardDailyOccupied}
      />

      <OccupiedModal
        room={selectedForOccupied}
        allRooms={rooms}
        isOpen={Boolean(selectedForOccupied)}
        onClose={() => setSelectedForOccupied(null)}
      />
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
          : "bg-background text-muted-foreground hover:bg-accent border-muted-foreground/20"
      }`}
    >
      {label}
    </button>
  );
}

function WingSection({
  title,
  subtitle,
  rooms,
  onRoomClick,
  allStandardOccupied,
}: {
  title: string;
  subtitle: string;
  rooms: RoomWithRelations[];
  onRoomClick: (room: RoomWithRelations) => void;
  allStandardOccupied: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between border-b pb-1.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {rooms.filter((r) => r.status === "AVAILABLE").length} Available
        </span>
      </div>

      {rooms.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
          No rooms match the selected filters in this wing.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={() => onRoomClick(room)}
              allStandardOccupied={allStandardOccupied}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({
  room,
  onClick,
  allStandardOccupied,
}: {
  room: RoomWithRelations;
  onClick: () => void;
  allStandardOccupied: boolean;
}) {
  const isLocked = room.mode === "PERSONAL" || room.mode === "STORE_ROOM";
  const isStandby = room.mode === "STANDBY";
  const activeBooking = room.bookings?.[0];
  const guest = activeBooking?.guest;

  const metrics = activeBooking ? calculateStayUnitsAndBill(activeBooking, new Date()) : null;

  let statusBadge = "bg-emerald-600 text-white";
  let statusText = "Available";
  let borderColor = "border-emerald-500/30 hover:border-emerald-500";
  let bgGradient = "bg-card";

  if (isLocked) {
    statusBadge = "bg-zinc-700 text-white";
    statusText = room.mode === "PERSONAL" ? "Personal" : "Store Room";
    borderColor = "border-border opacity-70";
  } else if (room.status === "OCCUPIED") {
    statusBadge = "bg-rose-600 text-white";
    statusText = "Occupied";
    borderColor = "border-rose-500/30 hover:border-rose-500";
    bgGradient = "bg-rose-500/[0.03]";
  } else if (room.status === "NEEDS_CLEANING") {
    statusBadge = "bg-amber-600 text-white";
    statusText = "Needs Cleaning";
    borderColor = "border-amber-500/40 hover:border-amber-500";
    bgGradient = "bg-amber-500/[0.04]";
  } else if (room.status === "MAINTENANCE") {
    statusBadge = "bg-purple-700 text-white";
    statusText = "Maintenance";
    borderColor = "border-purple-500/30";
  }

  return (
    <div
      onClick={onClick}
      className={`relative border rounded-xl p-3 shadow-xs transition-all cursor-pointer select-none flex flex-col justify-between min-h-[148px] ${borderColor} ${bgGradient}`}
    >
      {/* Top Strip: Room Number & Status */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-foreground">
              {room.roomNumber}
            </span>
            {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          <Badge className={`text-[10px] px-1.5 py-0 font-medium ${statusBadge}`}>
            {statusText}
          </Badge>
        </div>

        {/* Special Badges: Standby / Monthly / Price */}
        <div className="flex flex-wrap gap-1 mt-1">
          {isStandby && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-semibold"
            >
              Standby {!allStandardOccupied && "• Warn"}
            </Badge>
          )}
          {activeBooking?.stayType === "MONTHLY" && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-500/10 font-semibold"
            >
              Monthly
            </Badge>
          )}
          {room.defaultHintPrice && (
            <span className="text-[10px] text-muted-foreground font-semibold">
              ₹{room.defaultHintPrice}
            </span>
          )}
        </div>
      </div>

      {/* Middle: Active Guest with Day, Paid, Accrued or Amenities */}
      <div className="my-2">
        {room.status === "OCCUPIED" && guest && metrics ? (
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-foreground truncate flex items-center justify-between">
              <div className="flex items-center gap-1 truncate">
                <User className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate">{guest.fullName}</span>
              </div>
              <Badge variant="outline" className="text-[9px] px-1 py-0 font-medium shrink-0">
                {metrics.unitLabel === "day" ? `Day ${metrics.elapsedUnits}` : `Mo ${metrics.elapsedUnits}`}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Paid: <strong className="text-emerald-600 font-semibold">₹{activeBooking.totalPaid}</strong></span>
              <span>Due: <strong className={metrics.balanceDue > 0 ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"}>₹{metrics.balanceDue}</strong></span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {activeBooking.expectedCheckOut
                ? `Out: ${new Date(activeBooking.expectedCheckOut).toLocaleDateString()} (12 PM)`
                : "Open-Ended (12 PM)"}
            </div>
          </div>
        ) : room.status === "NEEDS_CLEANING" ? (
          <div className="text-center py-1">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">
              Tap to Mark Cleaned
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 text-muted-foreground">
            {/* Cooling badge */}
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded">
              <Wind className="h-2.5 w-2.5" />
              {room.cooling === "AC"
                ? "AC"
                : room.cooling === "FAN_COOLER"
                ? "Cooler"
                : "Fan"}
            </span>

            {/* Bed type */}
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded">
              <BedDouble className="h-2.5 w-2.5" />
              {room.bedType === "BETTER_BED"
                ? "Better"
                : room.bedType === "DOUBLE_BED"
                ? "Double"
                : room.bedType === "SINGLE_BED"
                ? "Single"
                : "Normal"}
            </span>

            {/* Bath */}
            {room.isAttached && (
              <span className="inline-flex items-center text-[10px] bg-muted px-1.5 py-0.5 rounded">
                Bath
              </span>
            )}
            {/* TV */}
            {room.hasTv && (
              <span className="inline-flex items-center text-[10px] bg-muted px-1.5 py-0.5 rounded">
                TV
              </span>
            )}
            {/* Kitchen */}
            {room.hasKitchen && (
              <span className="inline-flex items-center text-[10px] bg-muted px-1.5 py-0.5 rounded">
                Kitchen
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Sub-hint or notes */}
      <div className="text-[10px] text-muted-foreground border-t pt-1 flex items-center justify-between">
        <span className="truncate">
          {room.notes || (room.status === "AVAILABLE" ? "Tap for Check-In" : "")}
        </span>
        {room.issues?.length > 0 && (
          <span className="text-rose-500 font-bold shrink-0 ml-1">
            {room.issues.length} {room.issues.length === 1 ? "Issue" : "Issues"}
          </span>
        )}
      </div>
    </div>
  );
}
