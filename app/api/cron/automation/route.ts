import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { runDueJobs } from "@/lib/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/automation — ежесуточный запуск Vercel Cron: выполняет отложенные действия, которые не успели во время работы пользователей.
// Защищён секретом CRON_SECRET (Vercel Cron передаёт его в заголовке Authorization).
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    await connectDB();
    return NextResponse.json({ ran: await runDueJobs() });
}
