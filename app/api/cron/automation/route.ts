import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { runDueJobs } from "@/lib/automation";
import { sweepOverdueInvoices } from "@/lib/finance/overdue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/automation — ежесуточный запуск Vercel Cron: выполняет отложенные действия автоматизации и переводит
// просроченные счета в статус "overdue". Защищён секретом CRON_SECRET (Vercel Cron передаёт его в заголовке Authorization).
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    await connectDB();
    const [ran, overdue] = await Promise.all([runDueJobs(), sweepOverdueInvoices()]);
    return NextResponse.json({ ran, overdue });
}
