import { prisma } from "@/lib/prisma";
import { getExpenses } from "@/actions/finance-and-issues-actions";
import { calculateStayUnitsAndBill } from "@/lib/booking-utils";
import { FinanceView } from "@/components/finance/finance-view";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Month Payments strictly from BookingPayment records
  const monthPayments = await prisma.bookingPayment.findMany({
    where: {
      paidAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    include: {
      booking: {
        include: { room: true, guest: true },
      },
    },
    orderBy: { paidAt: "desc" },
  });

  const grossRevenue = monthPayments.reduce((sum, p) => sum + p.amount, 0);
  const cashRevenue = monthPayments
    .filter((p) => p.paymentMode === "CASH")
    .reduce((sum, p) => sum + p.amount, 0);
  const upiRevenue = monthPayments
    .filter((p) => p.paymentMode === "UPI")
    .reduce((sum, p) => sum + p.amount, 0);

  // Month Expenses
  const expensesRes = await getExpenses();
  const expenses = expensesRes.expenses || [];

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const cashExpenses = expenses
    .filter((e) => e.paymentMode === "CASH")
    .reduce((sum, e) => sum + e.amount, 0);
  const upiExpenses = expenses
    .filter((e) => e.paymentMode === "UPI")
    .reduce((sum, e) => sum + e.amount, 0);

  const netProfit = grossRevenue - totalExpenses;
  const netCashInHand = cashRevenue - cashExpenses;

  // Active Running Balances of active guests
  const activeBookings = await prisma.booking.findMany({
    where: { status: "ACTIVE" },
    select: { checkIn: true, agreedRate: true, stayType: true, totalPaid: true },
  });

  let pendingRunningBalance = 0;
  for (const b of activeBookings) {
    const { balanceDue } = calculateStayUnitsAndBill(b, now);
    pendingRunningBalance += balanceDue;
  }

  const summary = {
    grossRevenue,
    cashRevenue,
    upiRevenue,
    totalExpenses,
    cashExpenses,
    upiExpenses,
    netProfit,
    netCashInHand,
    pendingRunningBalance,
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
          Finance & Revenue Ledger
        </h1>
        <p className="text-xs text-muted-foreground">
          Cash & UPI collections from payments, pending guest balances, operational expenses, and physical cash in drawer.
        </p>
      </div>

      <FinanceView
        initialExpenses={expenses}
        recentPayments={monthPayments}
        summary={summary}
      />
    </div>
  );
}
