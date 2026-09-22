import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { runDueJobs } from "@/lib/automation";
import { sweepOverdueInvoices } from "@/lib/finance/overdue";
import { runRecurringInvoices } from "@/lib/finance/recurring";
import { sweepPaymentReminders } from "@/lib/finance/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/automation — ежесуточный запуск Vercel Cron: выполняет отложенные действия автоматизации, переводит
// просроченные счета в статус "overdue", генерирует очередные счета по шаблонам повторяющихся счетов и шлёт
// напоминания об оплате. Защищён секретом CRON_SECRET (Vercel Cron передаёт его в заголовке Authorization).
// Шаги идут последовательно (не Promise.all): overdue должен отработать раньше reminders, иначе счёт, ставший
// просроченным сегодня же, не попадёт в выборку напоминаний в этом самом запуске.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    await connectDB();
    const ran = await runDueJobs();
    const overdue = await sweepOverdueInvoices();
    const recurring = await runRecurringInvoices();
    const reminders = await sweepPaymentReminders();
    return NextResponse.json({ ran, overdue, recurring, reminders });
}
