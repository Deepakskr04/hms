import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOpenClawKey } from "@/lib/openclaw-auth";
import { safeRevalidatePath } from "@/lib/safe-revalidate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = verifyOpenClawKey(req);
  if (authError) return authError;

  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { expenseDate: "desc" },
      take: 50,
    });
    return NextResponse.json({ success: true, count: expenses.length, expenses });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authError = verifyOpenClawKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      title,
      category = "OTHER",
      amount,
      paymentMode = "CASH",
      notes,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "title is required." },
        { status: 400 }
      );
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "amount must be greater than zero." },
        { status: 400 }
      );
    }

    const validCategories = ["MAINTENANCE", "UTILITIES", "SUPPLIES", "STAFF", "OTHER"];
    const cat = validCategories.includes(category) ? category : "OTHER";

    const expense = await prisma.expense.create({
      data: {
        title: title.trim(),
        category: cat,
        amount: Math.round(Number(amount)),
        paymentMode: paymentMode === "UPI" ? "UPI" : "CASH",
        loggedBy: "OPENCLAW",
        expenseDate: new Date(),
        notes: notes || "Logged via OpenClaw API",
      },
    });

    safeRevalidatePath("/finance");
    safeRevalidatePath("/");

    return NextResponse.json({
      success: true,
      message: `Expense "${expense.title}" of ₹${expense.amount} (${expense.paymentMode}) logged successfully.`,
      expense: {
        id: expense.id,
        title: expense.title,
        category: expense.category,
        amount: expense.amount,
        paymentMode: expense.paymentMode,
        loggedBy: expense.loggedBy,
        expenseDate: expense.expenseDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in POST /api/openclaw/expenses:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to record expense",
      },
      { status: 400 }
    );
  }
}
