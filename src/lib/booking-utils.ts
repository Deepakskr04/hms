import { toTwelvePM } from "./date-utils";

/**
 * Calculate stay duration and accrued bill.
 * Standard 12:00 PM cycle (minimum 1 day, rolls over at 12:00 PM daily).
 */
export function calculateStayUnitsAndBill(
  booking: {
    checkIn: Date | string;
    agreedRate: number;
    stayType?: string;
    totalPaid?: number;
  },
  asOf: Date = new Date()
) {
  const checkInDate = new Date(booking.checkIn);
  const checkInRef = toTwelvePM(checkInDate);
  const diffMs = asOf.getTime() - checkInRef.getTime();

  const isMonthly = booking.stayType === "MONTHLY";

  if (isMonthly) {
    const elapsedDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    const elapsedMonths = Math.max(1, Math.ceil(elapsedDays / 30));
    const calculatedTotal = elapsedMonths * booking.agreedRate;
    const paid = booking.totalPaid ?? 0;
    const balanceDue = Math.max(0, calculatedTotal - paid);

    return {
      elapsedUnits: elapsedMonths,
      elapsedDays,
      unitLabel: "month",
      calculatedTotal,
      totalPaid: paid,
      balanceDue,
    };
  } else {
    const elapsedDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    const calculatedTotal = elapsedDays * booking.agreedRate;
    const paid = booking.totalPaid ?? 0;
    const balanceDue = Math.max(0, calculatedTotal - paid);

    return {
      elapsedUnits: elapsedDays,
      elapsedDays,
      unitLabel: "day",
      calculatedTotal,
      totalPaid: paid,
      balanceDue,
    };
  }
}
