"use client";

import { useState } from "react";
import { Expense, BookingPayment, Booking, Guest, Room } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createExpense, deleteExpense } from "@/actions/finance-and-issues-actions";
import { toast } from "sonner";
import {
  IndianRupee,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Trash2,
  Loader2,
  Receipt,
  Clock,
} from "lucide-react";

type PaymentWithRelations = BookingPayment & {
  booking: Booking & { room: Room; guest: Guest };
};

interface FinanceSummary {
  grossRevenue: number;
  cashRevenue: number;
  upiRevenue: number;
  totalExpenses: number;
  cashExpenses: number;
  upiExpenses: number;
  netProfit: number;
  netCashInHand: number;
  pendingRunningBalance: number;
}

interface FinanceViewProps {
  initialExpenses: Expense[];
  recentPayments: PaymentWithRelations[];
  summary: FinanceSummary;
}

export function FinanceView({
  initialExpenses,
  recentPayments,
  summary,
}: FinanceViewProps) {
  const [activeTab, setActiveTab] = useState<"EXPENSES" | "RECEIPTS">("EXPENSES");
  const [isLogExpenseOpen, setIsLogExpenseOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<
    "MAINTENANCE" | "UTILITIES" | "SUPPLIES" | "STAFF" | "OTHER"
  >("MAINTENANCE");
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI">("CASH");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) {
      toast.error("Please provide a valid title and amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createExpense({
        title: title.trim(),
        category,
        amount,
        paymentMode,
        notes,
      });

      if (res.success) {
        toast.success(`Expense of ₹${amount} logged.`);
        setIsLogExpenseOpen(false);
        setTitle("");
        setAmount(0);
        setNotes("");
      } else {
        toast.error(res.error || "Failed to log expense");
      }
    } catch {
      toast.error("Error creating expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, expenseTitle: string) => {
    const confirm = window.confirm(`Delete expense "${expenseTitle}"?`);
    if (!confirm) return;

    const res = await deleteExpense(id);
    if (res.success) {
      toast.success("Expense deleted");
    } else {
      toast.error(res.error || "Failed to delete expense");
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Ledger Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Money In */}
        <div className="bg-card border rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Real Money In</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{summary.grossRevenue.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1">
              <span>Cash: ₹{summary.cashRevenue}</span>
              <span>•</span>
              <span>UPI: ₹{summary.upiRevenue}</span>
            </div>
          </div>
        </div>

        {/* Total Expenses Out */}
        <div className="bg-card border rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Expenses Out</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              ₹{summary.totalExpenses.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1">
              <span>Cash: ₹{summary.cashExpenses}</span>
              <span>•</span>
              <span>UPI: ₹{summary.upiExpenses}</span>
            </div>
          </div>
        </div>

        {/* Cash in Drawer */}
        <div className="bg-card border rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Cash in Drawer</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              ₹{summary.netCashInHand.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Physical cash balance
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-card border rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Net Profit</span>
            <IndianRupee className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-primary">
              ₹{summary.netProfit.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Collections minus costs
            </span>
          </div>
        </div>

        {/* Pending Running Balances KPI Card */}
        <div className="col-span-2 sm:col-span-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-200">
            <span className="text-xs font-semibold">Pending Guest Balances</span>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300">
              ₹{summary.pendingRunningBalance.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium">
              Unsettled active dues
            </span>
          </div>
        </div>
      </div>

      {/* Tab Switcher: Expenses vs Payment Receipts */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab("EXPENSES")}
            className={`pb-1.5 transition-colors border-b-2 ${
              activeTab === "EXPENSES"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Expenses Ledger ({initialExpenses.length})
          </button>
          <button
            onClick={() => setActiveTab("RECEIPTS")}
            className={`pb-1.5 transition-colors border-b-2 ${
              activeTab === "RECEIPTS"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Collections & Receipts ({recentPayments.length})
          </button>
        </div>

        {activeTab === "EXPENSES" && (
          <Button
            onClick={() => setIsLogExpenseOpen(true)}
            size="sm"
            className="gap-1.5 bg-primary text-xs font-semibold"
          >
            <Plus className="h-4 w-4" /> Log Expense
          </Button>
        )}
      </div>

      {/* Tab 1: Expenses Table */}
      {activeTab === "EXPENSES" && (
        initialExpenses.length === 0 ? (
          <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground space-y-2">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">No expenses logged yet this month.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Title / Purpose</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Logged By</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initialExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(expense.expenseDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {expense.title}
                        {expense.notes && (
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {expense.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {expense.category}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-600 dark:text-rose-400">
                        ₹{expense.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="secondary"
                          className={
                            expense.paymentMode === "CASH"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          }
                        >
                          {expense.paymentMode}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{expense.loggedBy}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExpense(expense.id, expense.title)}
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Tab 2: Receipts / Payments Table */}
      {activeTab === "RECEIPTS" && (
        recentPayments.length === 0 ? (
          <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground space-y-2">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">No payments received yet this month.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Room & Guest</th>
                    <th className="py-2.5 px-3">Payment Type</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(p.paidAt).toLocaleDateString()} {new Date(p.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        <span>Room {p.booking.room.roomNumber}</span>
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          {p.booking.guest.fullName} ({p.booking.guest.phone})
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={
                            p.paymentType === "ADVANCE"
                              ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                              : p.paymentType === "CHECKOUT_SETTLEMENT"
                              ? "border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/30"
                              : "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30"
                          }
                        >
                          {p.paymentType.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{p.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="secondary"
                          className={
                            p.paymentMode === "CASH"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          }
                        >
                          {p.paymentMode}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{p.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Log Expense Modal */}
      <Dialog open={isLogExpenseOpen} onOpenChange={setIsLogExpenseOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Log New Expense</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateExpense} className="space-y-3.5 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Expense Title / Reason *</label>
              <Input
                placeholder="e.g. Electrician Fan Repair"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Category</label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as
                        | "MAINTENANCE"
                        | "UTILITIES"
                        | "SUPPLIES"
                        | "STAFF"
                        | "OTHER"
                    )
                  }
                  className="w-full text-xs h-9 bg-background border rounded px-2"
                >
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="UTILITIES">Utilities</option>
                  <option value="SUPPLIES">Supplies</option>
                  <option value="STAFF">Staff Wages</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Amount (₹) *</label>
                <Input
                  type="number"
                  min={1}
                  value={amount || ""}
                  placeholder="₹ Amount"
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  required
                  className="h-9 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode("CASH")}
                  className={`py-1.5 text-xs font-semibold rounded border transition-colors ${
                    paymentMode === "CASH"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Cash (Drawer)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("UPI")}
                  className={`py-1.5 text-xs font-semibold rounded border transition-colors ${
                    paymentMode === "UPI"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  UPI (Online)
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Notes (Optional)</label>
              <Input
                placeholder="Vendor name or receipt info"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLogExpenseOpen(false)}
                disabled={isSubmitting}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 text-xs font-semibold bg-primary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Saving...
                  </>
                ) : (
                  "Record Expense"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
