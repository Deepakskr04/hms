"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  extendBookingStay,
  recordMidStayPayment,
  settleAndCheckOutBooking,
  swapBookingRoom,
} from "@/actions/booking-actions";
import { calculateStayUnitsAndBill } from "@/lib/booking-utils";
import { toast } from "sonner";
import {
  Phone,
  LogOut,
  ArrowRightLeft,
  CalendarPlus,
  Loader2,
  FileText,
  User,
  PlusCircle,
} from "lucide-react";
import { Room, Booking, Guest, BookingPayment } from "@prisma/client";

interface OccupiedModalProps {
  room: (Room & {
    bookings: (Booking & { guest: Guest; payments?: BookingPayment[] })[];
  }) | null;
  allRooms: Room[];
  isOpen: boolean;
  onClose: () => void;
}

export function OccupiedModal({
  room,
  allRooms,
  isOpen,
  onClose,
}: OccupiedModalProps) {
  const [activeTab, setActiveTab] = useState<
    "DETAILS" | "PART_PAY" | "SETTLE" | "EXTEND" | "SWAP"
  >("DETAILS");

  // Mid-stay part payment state
  const [partAmount, setPartAmount] = useState<number>(0);
  const [partPayMode, setPartPayMode] = useState<"CASH" | "UPI">("CASH");
  const [partNotes, setPartNotes] = useState("");

  // Settlement checkout state
  const [overrideFinalBill, setOverrideFinalBill] = useState<number>(0);
  const [settlePayMode, setSettlePayMode] = useState<"CASH" | "UPI" | "SPLIT">("CASH");
  const [settleCash, setSettleCash] = useState<number>(0);
  const [settleUpi, setSettleUpi] = useState<number>(0);

  // Extend stay state
  const [extendDays, setExtendDays] = useState(1);
  const [extendAmount, setExtendAmount] = useState<number>(0);
  const [extendPayMode, setExtendPayMode] = useState<"CASH" | "UPI" | "SPLIT">("CASH");
  const [extendCash, setExtendCash] = useState<number>(0);
  const [extendUpi, setExtendUpi] = useState<number>(0);

  // Swap room state
  const [selectedTargetRoomId, setSelectedTargetRoomId] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const activeBooking = room?.bookings?.[0];
  const guest = activeBooking?.guest;

  // Calculate live stay units and accrued bill
  const stayMetrics = activeBooking
    ? calculateStayUnitsAndBill(activeBooking, new Date())
    : { elapsedUnits: 1, unitLabel: "day", calculatedTotal: 0, totalPaid: 0, balanceDue: 0 };

  // Sync initial settlement bill when opening or activeBooking changes
  useEffect(() => {
    if (activeBooking) {
      const metrics = calculateStayUnitsAndBill(activeBooking, new Date());
      setOverrideFinalBill(metrics.calculatedTotal);
      const bal = Math.max(0, metrics.calculatedTotal - (activeBooking.totalPaid || 0));
      setSettleCash(bal);
      setSettleUpi(0);
      setSettlePayMode("CASH");
    }
  }, [activeBooking]);

  const handleOpenSettle = () => {
    if (!activeBooking) return;
    const metrics = calculateStayUnitsAndBill(activeBooking, new Date());
    setOverrideFinalBill(metrics.calculatedTotal);
    const bal = Math.max(0, metrics.calculatedTotal - (activeBooking.totalPaid || 0));
    setSettleCash(bal);
    setSettleUpi(0);
    setSettlePayMode("CASH");
    setActiveTab("SETTLE");
  };

  const handleOpenPartPay = () => {
    setPartAmount(0);
    setPartPayMode("CASH");
    setPartNotes("");
    setActiveTab("PART_PAY");
  };

  const handleOpenExtend = () => {
    if (!activeBooking) return;
    const rate = activeBooking.agreedRate;
    setExtendDays(1);
    setExtendAmount(rate);
    setExtendCash(rate);
    setExtendUpi(0);
    setExtendPayMode("CASH");
    setActiveTab("EXTEND");
  };

  const handleDaysChange = (days: number) => {
    if (!activeBooking) return;
    const d = Math.max(1, days);
    setExtendDays(d);
    const total = d * activeBooking.agreedRate;
    setExtendAmount(total);
    if (extendPayMode === "CASH") setExtendCash(total);
    else if (extendPayMode === "UPI") setExtendUpi(total);
  };

  // 1. Submit Mid-Stay Part Payment
  const handleConfirmPartPay = async () => {
    if (!activeBooking) return;
    if (partAmount <= 0) {
      toast.error("Please enter a valid payment amount greater than ₹0.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await recordMidStayPayment({
        bookingId: activeBooking.id,
        amount: partAmount,
        paymentMode: partPayMode,
        notes: partNotes || "Mid-stay part payment",
      });

      if (res.success) {
        toast.success(res.message);
        onClose();
        setActiveTab("DETAILS");
      } else {
        toast.error(res.error || "Failed to record payment");
      }
    } catch {
      toast.error("Error recording payment");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Submit Final Checkout Settlement
  const handleConfirmSettle = async () => {
    if (!activeBooking) return;

    const currentPaid = activeBooking.totalPaid || 0;
    const balanceDue = Math.max(0, overrideFinalBill - currentPaid);

    if (settlePayMode === "SPLIT" && balanceDue > 0) {
      if (settleCash + settleUpi !== balanceDue) {
        toast.error(`Split settlement amounts (₹${settleCash} + ₹${settleUpi}) must equal balance due ₹${balanceDue}`);
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await settleAndCheckOutBooking({
        bookingId: activeBooking.id,
        finalTotal: overrideFinalBill,
        paymentMode: balanceDue > 0 ? settlePayMode : "NONE",
        cashAmount: settlePayMode === "UPI" ? 0 : settleCash,
        upiAmount: settlePayMode === "CASH" ? 0 : settleUpi,
        notes: `Settled at checkout for ${guest?.fullName || "Guest"}`,
      });

      if (res.success) {
        toast.success(res.message);
        onClose();
        setActiveTab("DETAILS");
      } else {
        toast.error(res.error || "Failed to settle & check out");
      }
    } catch {
      toast.error("Error during check-out settlement");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Confirm Stay Extension
  const handleConfirmExtend = async () => {
    if (!activeBooking) return;
    setIsLoading(true);
    try {
      const res = await extendBookingStay({
        bookingId: activeBooking.id,
        additionalDays: extendDays,
        additionalAmount: extendAmount,
        paymentMode: extendPayMode,
        cashAmount: extendPayMode === "UPI" ? 0 : extendCash,
        upiAmount: extendPayMode === "CASH" ? 0 : extendUpi,
      });

      if (res.success) {
        toast.success(res.message);
        onClose();
        setActiveTab("DETAILS");
      } else {
        toast.error(res.error || "Failed to extend stay");
      }
    } catch {
      toast.error("Error extending booking");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Confirm Room Swap
  const handleConfirmSwap = async () => {
    if (!activeBooking || !selectedTargetRoomId) {
      toast.error("Please select a target available room.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await swapBookingRoom(activeBooking.id, selectedTargetRoomId);
      if (res.success) {
        toast.success(res.message);
        onClose();
        setActiveTab("DETAILS");
      } else {
        toast.error(res.error || "Failed to swap room");
      }
    } catch {
      toast.error("Error swapping room");
    } finally {
      setIsLoading(false);
    }
  };

  if (!room || !activeBooking) return null;

  // Available rooms for swap
  const availableRooms = allRooms.filter(
    (r) =>
      r.id !== room.id &&
      r.status === "AVAILABLE" &&
      r.mode !== "PERSONAL" &&
      r.mode !== "STORE_ROOM"
  );

  const currentPaid = activeBooking.totalPaid || 0;
  const balanceDue = Math.max(0, overrideFinalBill - currentPaid);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <span>Room {room.roomNumber}</span>
              <Badge variant="outline" className="text-xs">
                {room.wing.replace("_", " ")}
              </Badge>
            </DialogTitle>
            <Badge className="bg-rose-600 text-white hover:bg-rose-700">
              Occupied
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            {activeBooking.stayType} Stay • 12:00 PM Cycle • Negotiated Billing
          </DialogDescription>
        </DialogHeader>

        {/* Live Running Badges Strip */}
        <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-lg border text-center">
          <div>
            <span className="text-[10px] text-muted-foreground block font-medium">Duration</span>
            <span className="font-extrabold text-xs text-foreground">
              {stayMetrics.unitLabel === "day"
                ? `Day ${stayMetrics.elapsedUnits} of Stay`
                : `Month ${stayMetrics.elapsedUnits} of Stay`}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block font-medium">Paid So Far</span>
            <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
              ₹{stayMetrics.totalPaid.toLocaleString("en-IN")}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block font-medium">Accrued Balance</span>
            <span
              className={`font-extrabold text-xs ${
                stayMetrics.balanceDue > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              ₹{stayMetrics.balanceDue.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* View Switcher / Tabs */}
        <div className="flex border-b text-xs font-semibold gap-3 overflow-x-auto pt-1 pb-1">
          <button
            onClick={() => setActiveTab("DETAILS")}
            className={`pb-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "DETAILS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Guest & Details
          </button>
          <button
            onClick={handleOpenPartPay}
            className={`pb-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "PART_PAY"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            + Part Payment
          </button>
          <button
            onClick={handleOpenSettle}
            className={`pb-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "SETTLE"
                ? "border-rose-600 text-rose-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Settle & Check Out
          </button>
          <button
            onClick={handleOpenExtend}
            className={`pb-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "EXTEND"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Extend Stay
          </button>
          <button
            onClick={() => setActiveTab("SWAP")}
            className={`pb-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "SWAP"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Swap Room
          </button>
        </div>

        {/* TAB 1: DETAILS */}
        {activeTab === "DETAILS" && (
          <div className="space-y-4 pt-1">
            {/* Guest Summary Card */}
            <div className="bg-card border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm">{guest?.fullName}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {activeBooking.source}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-foreground">{guest?.phone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {guest?.idProofType}: {guest?.idProofNo}
                  </span>
                </div>
              </div>
            </div>

            {/* Stay & Tariff Details */}
            <div className="grid grid-cols-2 gap-2 bg-muted/30 border rounded-lg p-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Check-In</span>
                <span className="font-semibold text-foreground">
                  {new Date(activeBooking.checkIn).toLocaleDateString()} (12 PM)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Expected Check-Out</span>
                <span className="font-semibold text-foreground">
                  {activeBooking.expectedCheckOut
                    ? `${new Date(activeBooking.expectedCheckOut).toLocaleDateString()} (12 PM)`
                    : "Open-Ended"}
                </span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-muted-foreground block text-[11px]">Agreed Rate</span>
                <span className="font-bold text-foreground">
                  ₹{activeBooking.agreedRate} / {activeBooking.stayType === "DAILY" ? "day" : "month"}
                </span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-muted-foreground block text-[11px]">Total Paid So Far</span>
                <span className="font-bold text-emerald-600">
                  ₹{activeBooking.totalPaid}
                </span>
              </div>
            </div>

            {/* ID Photos Preview */}
            {(guest?.idFrontUrl || guest?.idBackUrl) && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  Stored ID Photos (Compressed WebP)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {guest.idFrontUrl && (
                    <a
                      href={guest.idFrontUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border rounded p-1 block bg-background hover:opacity-90"
                    >
                      <img
                        src={guest.idFrontUrl}
                        alt="ID Front"
                        className="h-24 w-full object-cover rounded"
                      />
                      <span className="text-[10px] text-center block mt-1 text-muted-foreground">
                        Front Photo
                      </span>
                    </a>
                  )}
                  {guest.idBackUrl && (
                    <a
                      href={guest.idBackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border rounded p-1 block bg-background hover:opacity-90"
                    >
                      <img
                        src={guest.idBackUrl}
                        alt="ID Back"
                        className="h-24 w-full object-cover rounded"
                      />
                      <span className="text-[10px] text-center block mt-1 text-muted-foreground">
                        Back Photo
                      </span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPartPay}
                className="text-xs h-9"
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                Part Pay
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExtend}
                className="text-xs h-9"
              >
                <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                Extend
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("SWAP")}
                className="text-xs h-9"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                Swap
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleOpenSettle}
                className="text-xs h-9 font-semibold"
              >
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Settle & Exit
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: PART PAYMENT */}
        {activeTab === "PART_PAY" && (
          <div className="space-y-4 pt-1">
            <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-foreground">
                Record Mid-Stay Payment for {guest?.fullName}
              </p>
              <p className="text-muted-foreground">
                Currently Paid: ₹{activeBooking.totalPaid} • Accrued Balance: ₹{stayMetrics.balanceDue}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Payment Amount (₹) *</label>
              <Input
                type="number"
                min={1}
                step={50}
                value={partAmount || ""}
                placeholder="Enter amount collected"
                onChange={(e) => setPartAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9 text-xs font-bold text-primary"
              />
            </div>

            <div className="space-y-2 bg-primary/5 p-3 rounded-lg border">
              <label className="text-xs font-semibold">Collection Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(["CASH", "UPI"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPartPayMode(mode)}
                    className={`py-1.5 text-xs font-semibold rounded border transition-colors ${
                      partPayMode === mode
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Payment Notes (Optional)</label>
              <Input
                placeholder="e.g. Received partial advance at front desk"
                value={partNotes}
                onChange={(e) => setPartNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("DETAILS")}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmPartPay}
                disabled={isLoading || partAmount <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  `Record ₹${partAmount} Payment`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: SETTLE & CHECK OUT */}
        {activeTab === "SETTLE" && (
          <div className="space-y-4 pt-1">
            <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  Checkout Settlement: {guest?.fullName}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {stayMetrics.elapsedUnits} {stayMetrics.unitLabel}(s) @ ₹{activeBooking.agreedRate}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1 border-t">
                <div>
                  Calculated Total:{" "}
                  <span className="font-bold text-foreground">
                    ₹{stayMetrics.calculatedTotal.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  Already Paid:{" "}
                  <span className="font-bold text-emerald-600">
                    ₹{currentPaid.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Final Agreed Bill Override */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center justify-between">
                <span>Final Agreed Bill (₹)</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Adjust for discounts / extra charges
                </span>
              </label>
              <Input
                type="number"
                min={0}
                step={50}
                value={overrideFinalBill}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value) || 0);
                  setOverrideFinalBill(val);
                  const newBal = Math.max(0, val - currentPaid);
                  if (settlePayMode === "CASH") {
                    setSettleCash(newBal);
                    setSettleUpi(0);
                  } else if (settlePayMode === "UPI") {
                    setSettleUpi(newBal);
                    setSettleCash(0);
                  } else {
                    setSettleCash(Math.round(newBal / 2));
                    setSettleUpi(newBal - Math.round(newBal / 2));
                  }
                }}
                className="h-9 text-xs font-bold"
              />
            </div>

            {/* Balance Due & Payment Method */}
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Balance Due Now:
                </span>
                <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                  ₹{balanceDue.toLocaleString("en-IN")}
                </span>
              </div>

              {balanceDue > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {(["CASH", "UPI", "SPLIT"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setSettlePayMode(mode);
                          if (mode === "CASH") {
                            setSettleCash(balanceDue);
                            setSettleUpi(0);
                          } else if (mode === "UPI") {
                            setSettleUpi(balanceDue);
                            setSettleCash(0);
                          } else {
                            setSettleCash(Math.round(balanceDue / 2));
                            setSettleUpi(balanceDue - Math.round(balanceDue / 2));
                          }
                        }}
                        className={`py-1 text-xs font-semibold rounded border transition-colors ${
                          settlePayMode === mode
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-background text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {settlePayMode === "SPLIT" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Input
                        type="number"
                        placeholder="Cash ₹"
                        value={settleCash}
                        onChange={(e) => {
                          const c = parseInt(e.target.value) || 0;
                          setSettleCash(c);
                          setSettleUpi(Math.max(0, balanceDue - c));
                        }}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="UPI ₹"
                        value={settleUpi}
                        onChange={(e) => {
                          const u = parseInt(e.target.value) || 0;
                          setSettleUpi(u);
                          setSettleCash(Math.max(0, balanceDue - u));
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("DETAILS")}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmSettle}
                disabled={isLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  `Settle & Check Out (${balanceDue > 0 ? `₹${balanceDue}` : "₹0 Due"})`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* TAB 4: EXTEND STAY */}
        {activeTab === "EXTEND" && (
          <div className="space-y-4 pt-1">
            <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-foreground">
                Extending stay for {guest?.fullName}
              </p>
              <p className="text-muted-foreground">
                Check-Out:{" "}
                {activeBooking.expectedCheckOut
                  ? `${new Date(activeBooking.expectedCheckOut).toLocaleDateString()} at 12:00 PM`
                  : "Currently Open-Ended"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Additional Days</label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={extendDays}
                  onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Advance Collected (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={extendAmount}
                  onChange={(e) => setExtendAmount(parseInt(e.target.value) || 0)}
                  className="h-9 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Payment Mode */}
            {extendAmount > 0 && (
              <div className="space-y-2 bg-primary/5 p-3 rounded-lg border">
                <label className="text-xs font-semibold">Payment Mode for Advance</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["CASH", "UPI", "SPLIT"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setExtendPayMode(mode)}
                      className={`py-1 text-xs font-semibold rounded border ${
                        extendPayMode === mode
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {extendPayMode === "SPLIT" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Input
                      type="number"
                      placeholder="Cash ₹"
                      value={extendCash}
                      onChange={(e) => {
                        const c = parseInt(e.target.value) || 0;
                        setExtendCash(c);
                        setExtendUpi(Math.max(0, extendAmount - c));
                      }}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="UPI ₹"
                      value={extendUpi}
                      onChange={(e) => {
                        const u = parseInt(e.target.value) || 0;
                        setExtendUpi(u);
                        setExtendCash(Math.max(0, extendAmount - u));
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("DETAILS")}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmExtend}
                disabled={isLoading}
                className="bg-primary font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  `Confirm Extension (₹${extendAmount})`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* TAB 5: SWAP ROOM */}
        {activeTab === "SWAP" && (
          <div className="space-y-4 pt-1">
            <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-foreground">
                Move {guest?.fullName} to Another Room
              </p>
              <p className="text-muted-foreground">
                Current Room {room.roomNumber} will automatically be flipped to &quot;Needs Cleaning&quot;.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Select Available Target Room</label>
              {availableRooms.length === 0 ? (
                <p className="text-xs text-rose-500 py-2">
                  No other clean/available rooms right now. Mark a room cleaned first.
                </p>
              ) : (
                <select
                  value={selectedTargetRoomId}
                  onChange={(e) => setSelectedTargetRoomId(e.target.value)}
                  className="w-full text-xs h-10 bg-background border rounded px-2"
                >
                  <option value="">-- Choose Target Room --</option>
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.wing.replace("_", " ")}) - {r.cooling}, {r.bedType}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("DETAILS")}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmSwap}
                disabled={isLoading || !selectedTargetRoomId}
                className="bg-primary font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Confirm Room Swap"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
