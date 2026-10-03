import { NextResponse } from "next/server";
import { runDueJobs } from "@/lib/automation";
import { sweepOverdueInvoices } from "@/lib/finance/overdue";
import { runRecurringInvoices } from "@/lib/finance/recurring";
import { sweepPaymentReminders } from "@/lib/finance/reminders";
import { reportError } from "@/lib/reportError";
import { syncAllAccounts } from "@/lib/mail";
import { startTelegramControl } from "@/lib/ai/telegramBot";

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

    // Каждый шаг отдельно: сбой одного не должен отменять остальные, а сам сбой — остаться незамеченным
    // (раньше здесь не было обработки ошибок вообще, и упавший обход было видно только в журнале Vercel)
    const step = async <T>(name: string, run: () => Promise<T>): Promise<T | null> => {
        try {
            return await run();
        } catch (e) {
            await reportError(e, { where: `ежесуточный обход: ${name}` });
            return null;
        }
    };

    const ran = await step("автоматизация", () => runDueJobs());
    const overdue = await step("просроченные счета", () => sweepOverdueInvoices());
    const recurring = await step("повторяющиеся счета", () => runRecurringInvoices());
    const reminders = await step("напоминания об оплате", () => sweepPaymentReminders());
    // входящая почта: обновляется и когда страница почты закрыта (раньше — только пока она открыта)
    const mail = await step("почта", () => syncAllAccounts());
    startTelegramControl(); // запасной запуск опроса Telegram, если instrumentation не сработал (ничего не делает, если уже идёт)
    return NextResponse.json({ ran, overdue, recurring, reminders, mail });
}
