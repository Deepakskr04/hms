"use client";

import { useState } from "react";
import { HotelIssue, Room } from "@prisma/client";
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
import {
  createHotelIssue,
  resolveHotelIssue,
} from "@/actions/finance-and-issues-actions";
import { toast } from "sonner";
import {
  Wrench,
  Plus,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from "lucide-react";

type IssueWithRoom = HotelIssue & {
  room: Room | null;
};

interface IssuesViewProps {
  initialIssues: IssueWithRoom[];
  rooms: Room[];
}

export function IssuesView({ initialIssues, rooms }: IssuesViewProps) {
  const [activeTab, setActiveTab] = useState<"OPEN" | "RESOLVED">("OPEN");

  // Create Issue Modal state
  const [isLogIssueOpen, setIsLogIssueOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [blockRoom, setBlockRoom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resolve Issue Dialog state
  const [resolvingIssue, setResolvingIssue] = useState<IssueWithRoom | null>(null);
  const [logExpense, setLogExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI">("CASH");

  const openIssues = initialIssues.filter((i) => i.status === "OPEN");
  const resolvedIssues = initialIssues.filter((i) => i.status === "RESOLVED");

  const currentList = activeTab === "OPEN" ? openIssues : resolvedIssues;

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter an issue description.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createHotelIssue({
        title: title.trim(),
        priority,
        blockRoom,
        roomId: selectedRoomId || undefined,
      });

      if (res.success) {
        toast.success(
          blockRoom && selectedRoomId
            ? "Issue logged and Room marked under MAINTENANCE."
            : "Hotel issue reported."
        );
        setIsLogIssueOpen(false);
        setTitle("");
        setSelectedRoomId("");
        setBlockRoom(false);
        setPriority("NORMAL");
      } else {
        toast.error(res.error || "Failed to create issue");
      }
    } catch {
      toast.error("Error creating issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenResolve = (issue: IssueWithRoom) => {
    setResolvingIssue(issue);
    setLogExpense(false);
    setExpenseTitle(`Repair: ${issue.title}`);
    setExpenseAmount(0);
    setPaymentMode("CASH");
  };

  const handleConfirmResolve = async () => {
    if (!resolvingIssue) return;

    if (logExpense && (!expenseTitle || expenseAmount <= 0)) {
      toast.error("Please provide valid expense title and amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resolveHotelIssue({
        issueId: resolvingIssue.id,
        logExpense,
        expenseTitle: logExpense ? expenseTitle : undefined,
        expenseAmount: logExpense ? expenseAmount : undefined,
        paymentMode: logExpense ? paymentMode : undefined,
      });

      if (res.success) {
        toast.success(
          resolvingIssue.blockRoom && resolvingIssue.roomId
            ? "Issue resolved! Room restored to Available."
            : "Issue marked as Resolved."
        );
        setResolvingIssue(null);
      } else {
        toast.error(res.error || "Failed to resolve issue");
      }
    } catch {
      toast.error("Error resolving issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & New Button */}
      <div className="flex items-center justify-between">
        {/* Tab switch */}
        <div className="flex border-b text-xs sm:text-sm font-semibold gap-4">
          <button
            onClick={() => setActiveTab("OPEN")}
            className={`pb-2 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "OPEN"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Open Tasks</span>
            <Badge
              variant={openIssues.length > 0 ? "destructive" : "secondary"}
              className="text-[10px] px-1.5 py-0"
            >
              {openIssues.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab("RESOLVED")}
            className={`pb-2 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "RESOLVED"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Resolved</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {resolvedIssues.length}
            </Badge>
          </button>
        </div>

        <Button
          onClick={() => setIsLogIssueOpen(true)}
          size="sm"
          className="gap-1.5 bg-primary text-xs font-semibold"
        >
          <Plus className="h-4 w-4" /> Log Issue
        </Button>
      </div>

      {/* Issues List */}
      {currentList.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground space-y-2">
          <Wrench className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {activeTab === "OPEN"
              ? "All clear! No open maintenance issues."
              : "No resolved issues on file."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentList.map((issue) => (
            <div
              key={issue.id}
              className="bg-card border rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {issue.room ? (
                    <Badge variant="outline" className="text-xs font-bold border-primary text-primary">
                      Room {issue.room.roomNumber}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      General Property
                    </Badge>
                  )}

                  <Badge
                    className={`text-[10px] ${
                      issue.priority === "URGENT"
                        ? "bg-rose-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {issue.priority}
                  </Badge>

                  {issue.blockRoom && (
                    <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> Blocks Room
                    </Badge>
                  )}

                  <span className="text-xs text-muted-foreground">
                    • Logged by {issue.loggedBy.toLowerCase()} on{" "}
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="font-semibold text-sm text-foreground">
                  {issue.title}
                </p>

                {issue.resolvedAt && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resolved on {new Date(issue.resolvedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {issue.status === "OPEN" && (
                <div className="flex justify-end pt-1 sm:pt-0">
                  <Button
                    size="sm"
                    onClick={() => handleOpenResolve(issue)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resolve Issue
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Log Issue Modal */}
      <Dialog open={isLogIssueOpen} onOpenChange={setIsLogIssueOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Report Hotel Issue</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateIssue} className="space-y-3.5 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Issue Title / Description *</label>
              <Input
                placeholder="e.g. Geyser tripping breaker, AC water leakage"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Room (Optional)</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full text-xs h-9 bg-background border rounded px-2"
                >
                  <option value="">-- General Property --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.wing.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "NORMAL" | "URGENT")}
                  className="w-full text-xs h-9 bg-background border rounded px-2"
                >
                  <option value="NORMAL">Normal Priority</option>
                  <option value="URGENT">Urgent / Immediate</option>
                </select>
              </div>
            </div>

            {/* Block Room Checkbox */}
            {selectedRoomId && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="blockRoom"
                  checked={blockRoom}
                  onChange={(e) => setBlockRoom(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-primary"
                />
                <label htmlFor="blockRoom" className="text-xs cursor-pointer select-none">
                  <span className="font-semibold text-foreground block">
                    Block room under MAINTENANCE?
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    Prevents staff from checking guests into this room until resolved.
                  </span>
                </label>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLogIssueOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-primary font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Submit Issue"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resolve Issue Dialog with Optional Expense */}
      <Dialog
        open={Boolean(resolvingIssue)}
        onOpenChange={(open) => !open && setResolvingIssue(null)}
      >
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Resolve Issue: {resolvingIssue?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {resolvingIssue?.blockRoom && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20 font-medium">
                ✓ Room {resolvingIssue?.room?.roomNumber} will automatically be restored to Available.
              </p>
            )}

            {/* Optional Repair Expense Toggle */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="logRepairExpense"
                  checked={logExpense}
                  onChange={(e) => setLogExpense(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <label htmlFor="logRepairExpense" className="text-xs font-semibold cursor-pointer">
                  Log a repair / technician expense now?
                </label>
              </div>

              {logExpense && (
                <div className="space-y-2.5 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold">Expense Title</label>
                    <Input
                      value={expenseTitle}
                      onChange={(e) => setExpenseTitle(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold">Amount (₹)</label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="₹ Amount"
                        value={expenseAmount || ""}
                        onChange={(e) => setExpenseAmount(parseInt(e.target.value) || 0)}
                        className="h-8 text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold">Payment Mode</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value as "CASH" | "UPI")}
                        className="w-full text-xs h-8 bg-background border rounded px-1.5"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResolvingIssue(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmResolve}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  "Confirm Resolution"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
