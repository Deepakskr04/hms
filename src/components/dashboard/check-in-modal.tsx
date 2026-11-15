"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createAndCheckInBooking,
  lookupGuestByPhone,
} from "@/actions/booking-actions";
import { uploadGuestIdImage } from "@/actions/guest-id-upload";
import { compressImageToWebP } from "@/lib/image-compress";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UserCheck,
  Upload,
} from "lucide-react";
import { Room } from "@prisma/client";

interface CheckInModalProps {
  room: (Room & { defaultHintPrice?: number | null }) | null;
  isOpen: boolean;
  onClose: () => void;
  allStandardOccupied?: boolean;
}

export function CheckInModal({
  room,
  isOpen,
  onClose,
  allStandardOccupied,
}: CheckInModalProps) {
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [idProofType, setIdProofType] = useState("AADHAAR");
  const [idProofNo, setIdProofNo] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [source, setSource] = useState<"WALK_IN" | "PHONE_CALL">("WALK_IN");

  // Flexible Billing & Open-Ended Checkout
  const [stayType, setStayType] = useState<"DAILY" | "MONTHLY">("DAILY");
  const [isOpenEnded, setIsOpenEnded] = useState(true);
  const [expectedCheckOutDate, setExpectedCheckOutDate] = useState("");

  const [agreedRate, setAgreedRate] = useState<number>(0);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "SPLIT">("CASH");
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [upiAmount, setUpiAmount] = useState<number>(0);
  const [guestNotes, setGuestNotes] = useState("");

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [returningGuestInfo, setReturningGuestInfo] = useState<{
    visitCount: number;
    lastRoom?: string;
  } | null>(null);

  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize rate hint when room or stayType changes
  useEffect(() => {
    if (room) {
      if (stayType === "MONTHLY") {
        const hint = room.roomNumber === "103" ? 5000 : (room.defaultHintPrice ? room.defaultHintPrice * 15 : 6000);
        setAgreedRate(hint);
        setAdvancePaid(hint);
        setCashAmount(0);
        setUpiAmount(hint);
        setPaymentMode("UPI");
      } else {
        const hint = room.defaultHintPrice || 600;
        setAgreedRate(hint);
        setAdvancePaid(hint); // Default 1-day token advance
        setCashAmount(hint);
        setUpiAmount(0);
        setPaymentMode("CASH");
      }
    }
  }, [room, stayType]);

  // Handle cash/upi auto-sync with advancePaid
  const handleAdvanceChange = (val: number) => {
    const amt = Math.max(0, val);
    setAdvancePaid(amt);
    if (paymentMode === "CASH") {
      setCashAmount(amt);
      setUpiAmount(0);
    } else if (paymentMode === "UPI") {
      setUpiAmount(amt);
      setCashAmount(0);
    } else if (paymentMode === "SPLIT") {
      setCashAmount(Math.round(amt / 2));
      setUpiAmount(amt - Math.round(amt / 2));
    }
  };

  const handleRateChange = (newRate: number) => {
    setAgreedRate(newRate);
    handleAdvanceChange(newRate); // Auto-fill 1-day advance with new rate
  };

  const handlePaymentModeChange = (mode: "CASH" | "UPI" | "SPLIT") => {
    setPaymentMode(mode);
    if (mode === "CASH") {
      setCashAmount(advancePaid);
      setUpiAmount(0);
    } else if (mode === "UPI") {
      setUpiAmount(advancePaid);
      setCashAmount(0);
    } else if (mode === "SPLIT") {
      setCashAmount(Math.round(advancePaid / 2));
      setUpiAmount(advancePaid - Math.round(advancePaid / 2));
    }
  };

  // Handle phone auto-lookup
  const handlePhoneBlur = async () => {
    if (!phone || phone.trim().length < 10) return;
    setIsLookingUp(true);
    try {
      const existing = await lookupGuestByPhone(phone.trim());
      if (existing) {
        setFullName(existing.fullName);
        setIdProofType(existing.idProofType);
        setIdProofNo(existing.idProofNo);
        if (existing.idFrontUrl) setIdFrontUrl(existing.idFrontUrl);
        if (existing.idBackUrl) setIdBackUrl(existing.idBackUrl);
        setReturningGuestInfo({
          visitCount: existing.bookings.length,
          lastRoom: existing.bookings[0]?.room?.roomNumber,
        });
        toast.info(
          `Returning Guest: ${existing.fullName} (${existing.bookings.length} past stays)`
        );
      } else {
        setReturningGuestInfo(null);
      }
    } catch {
      // ignore
    } finally {
      setIsLookingUp(false);
    }
  };

  // Handle Photo Capture/Upload with client WebP compression
  const handleImageCapture = async (
    e: React.ChangeEvent<HTMLInputElement>,
    side: "front" | "back"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (side === "front") setUploadingFront(true);
    else setUploadingBack(true);

    try {
      const compressedWebp = await compressImageToWebP(file, 1280, 100 * 1024);

      const formData = new FormData();
      formData.append("file", compressedWebp);
      formData.append("side", side);
      formData.append("phone", phone || "guest");

      const res = await uploadGuestIdImage(formData);
      if (res.success && res.url) {
        if (side === "front") setIdFrontUrl(res.url);
        else setIdBackUrl(res.url);
        toast.success(`ID ${side} captured & compressed (${Math.round(compressedWebp.size / 1024)} KB)`);
      } else {
        toast.error(res.error || `Failed to upload ID ${side}`);
      }
    } catch {
      toast.error("Failed to compress or upload image");
    } finally {
      if (side === "front") setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;

    if (!fullName.trim() || !phone.trim()) {
      toast.error("Guest name and 10-digit phone number are required.");
      return;
    }

    if (agreedRate <= 0) {
      toast.error("Agreed rate must be greater than zero.");
      return;
    }

    if (paymentMode === "SPLIT" && advancePaid > 0 && cashAmount + upiAmount !== advancePaid) {
      toast.error(`Split amounts (₹${cashAmount} + ₹${upiAmount}) must equal advance paid (₹${advancePaid})`);
      return;
    }

    if (show114Warning) {
      const confirmOverride = window.confirm(
        "Room 114 is reserved for Family / Standby use. Standard rooms are still free. Confirm manual override check-in?"
      );
      if (!confirmOverride) return;
    }

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await createAndCheckInBooking({
        roomId: room.id,
        fullName: fullName.trim(),
        phone: phone.trim(),
        idProofType,
        idProofNo: idProofNo || "ON_FILE",
        idFrontUrl: idFrontUrl || undefined,
        idBackUrl: idBackUrl || undefined,
        guestNotes,
        source,
        stayType,
        checkInDate: today,
        expectedCheckOutDate: isOpenEnded ? null : expectedCheckOutDate || null,
        agreedRate,
        advancePaid,
        paymentMode,
        cashAmount: paymentMode === "UPI" ? 0 : cashAmount,
        upiAmount: paymentMode === "CASH" ? 0 : upiAmount,
      });

      if (res.success) {
        toast.success(res.message || `Room ${room.roomNumber} checked in successfully!`);
        onClose();
      } else {
        toast.error(res.error || "Failed to complete check-in");
      }
    } catch {
      toast.error("Error creating booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!room) return null;

  const isRoom114 = room.roomNumber === "114";
  const show114Warning = isRoom114 && !allStandardOccupied;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <span>Check-In: Room {room.roomNumber}</span>
              <Badge variant="outline" className="text-xs">
                {room.wing.replace("_", " ")}
              </Badge>
            </DialogTitle>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Available
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Standard check-out is 12:00 PM. Rates are negotiated advance tokens with Zero GST.
          </DialogDescription>
        </DialogHeader>

        {/* Room 114 Standby Warning Alert */}
        {show114Warning && (
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg p-3 text-amber-900 dark:text-amber-200 text-xs flex gap-2.5 items-start">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Standby / Family Room (114)</p>
              <p className="mt-0.5 text-muted-foreground">
                Standard daily rooms are still available. Room 114 is reserved as a last resort, but manual booking override is allowed.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Stay Type Selector (Daily vs Monthly on ANY room) */}
          <div className="flex items-center justify-between bg-muted/40 p-2 rounded-lg border">
            <span className="text-xs font-semibold text-foreground">Billing Cycle:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setStayType("DAILY")}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all ${
                  stayType === "DAILY"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                Daily Stay
              </button>
              <button
                type="button"
                onClick={() => setStayType("MONTHLY")}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all ${
                  stayType === "MONTHLY"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                Monthly Stay
              </button>
            </div>
          </div>

          {/* Guest Phone & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center justify-between">
                <span>Phone Number *</span>
                {isLookingUp && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </label>
              <Input
                type="tel"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handlePhoneBlur}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Guest Full Name *</label>
              <Input
                placeholder="Enter full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-9"
              />
            </div>
          </div>

          {/* Returning Guest Pill */}
          {returningGuestInfo && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md p-2 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" />
                <span>
                  Returning Guest ({returningGuestInfo.visitCount} previous stays
                  {returningGuestInfo.lastRoom ? `, last in Room ${returningGuestInfo.lastRoom}` : ""})
                </span>
              </div>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded font-medium">
                ID Reused
              </span>
            </div>
          )}

          {/* ID Capture Section */}
          <div className="border rounded-lg p-3 space-y-2.5 bg-muted/30">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-primary" />
                <span>Government ID (Compressed WebP)</span>
              </span>
              <select
                value={idProofType}
                onChange={(e) => setIdProofType(e.target.value)}
                className="text-[11px] h-7 bg-background border rounded px-1.5"
              >
                <option value="AADHAAR">Aadhaar</option>
                <option value="DRIVING_LICENSE">Driving License</option>
                <option value="VOTER_ID">Voter ID</option>
                <option value="PAN">PAN Card</option>
                <option value="PASSPORT">Passport</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Front Photo */}
              <div className="border border-dashed rounded-md p-2 text-center bg-background flex flex-col items-center justify-center min-h-[70px] relative">
                {idFrontUrl ? (
                  <div className="space-y-1">
                    <img
                      src={idFrontUrl}
                      alt="Front ID"
                      className="h-10 w-auto max-w-full mx-auto object-cover rounded"
                    />
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium justify-center">
                      <CheckCircle2 className="h-3 w-3" /> Front OK
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center text-muted-foreground hover:text-foreground">
                    {uploadingFront ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <span className="text-[10px] mt-1 font-medium">
                      {uploadingFront ? "Compressing..." : "+ ID Front"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleImageCapture(e, "front")}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Back Photo */}
              <div className="border border-dashed rounded-md p-2 text-center bg-background flex flex-col items-center justify-center min-h-[70px] relative">
                {idBackUrl ? (
                  <div className="space-y-1">
                    <img
                      src={idBackUrl}
                      alt="Back ID"
                      className="h-10 w-auto max-w-full mx-auto object-cover rounded"
                    />
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium justify-center">
                      <CheckCircle2 className="h-3 w-3" /> Back OK
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center text-muted-foreground hover:text-foreground">
                    {uploadingBack ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <span className="text-[10px] mt-1 font-medium">
                      {uploadingBack ? "Compressing..." : "+ ID Back"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleImageCapture(e, "back")}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Stay Details: Source & Open-Ended Checkout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Booking Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as "WALK_IN" | "PHONE_CALL")}
                className="w-full text-xs h-9 bg-background border rounded px-2"
              >
                <option value="WALK_IN">Walk-In Guest</option>
                <option value="PHONE_CALL">Phone Call Booking</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold">Expected Check-out</label>
                <button
                  type="button"
                  onClick={() => setIsOpenEnded(!isOpenEnded)}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {isOpenEnded ? "Set Specific Date" : "Make Open-Ended"}
                </button>
              </div>

              {isOpenEnded ? (
                <div className="h-9 px-3 bg-muted/50 rounded-md border text-xs flex items-center text-muted-foreground">
                  <span>Open-Ended (Not Fixed)</span>
                </div>
              ) : (
                <Input
                  type="date"
                  value={expectedCheckOutDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setExpectedCheckOutDate(e.target.value)}
                  className="h-9 text-xs"
                />
              )}
            </div>
          </div>

          {/* Tariff Negotiation & Advance Paid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                Agreed Rate ({stayType === "DAILY" ? "₹ / Day" : "₹ / Month"}) *
              </label>
              <Input
                type="number"
                min={100}
                step={50}
                value={agreedRate}
                onChange={(e) => handleRateChange(parseInt(e.target.value) || 0)}
                className="h-9 text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center justify-between">
                <span>Advance Paid Now (₹)</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {stayType === "DAILY" ? "1-day default" : "Token / 1 mo"}
                </span>
              </label>
              <Input
                type="number"
                min={0}
                step={50}
                value={advancePaid}
                onChange={(e) => handleAdvanceChange(parseInt(e.target.value) || 0)}
                className="h-9 text-xs font-bold text-primary"
              />
            </div>
          </div>

          {/* Payment Method for Advance */}
          <div className="bg-primary/5 border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Advance Collection Mode:</span>
              <span className="font-bold text-primary">₹{advancePaid}</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {(["CASH", "UPI", "SPLIT"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handlePaymentModeChange(mode)}
                  className={`py-1 text-xs font-semibold rounded border transition-colors ${
                    paymentMode === mode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {paymentMode === "SPLIT" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    Cash Portion (₹)
                  </label>
                  <Input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => {
                      const c = parseInt(e.target.value) || 0;
                      setCashAmount(c);
                      setUpiAmount(Math.max(0, advancePaid - c));
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    UPI Portion (₹)
                  </label>
                  <Input
                    type="number"
                    value={upiAmount}
                    onChange={(e) => {
                      const u = parseInt(e.target.value) || 0;
                      setUpiAmount(u);
                      setCashAmount(Math.max(0, advancePaid - u));
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              Notes (Optional)
            </label>
            <Input
              value={guestNotes}
              onChange={(e) => setGuestNotes(e.target.value)}
              placeholder="e.g. extra bedding, vehicle number"
              className="h-8 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Checking In...
                </>
              ) : (
                `Confirm & Check In (₹${advancePaid} Advance)`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
