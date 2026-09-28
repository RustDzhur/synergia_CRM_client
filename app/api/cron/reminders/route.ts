import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { sweepEventReminders } from "@/lib/calendar/reminders";
import { runDueJobs } from "@/lib/automation";
import { syncCalendars } from "@/lib/calendar/sync";
import { reportError } from "@/lib/reportError";
import Event from "@/models/Event";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/reminders — частый запуск (раз в пять минут, см. vercel.json): напоминания о событиях
// календаря и отложенные действия автоматизации.
//
// Зачем отдельный маршрут. Раньше единственным «тиком» был опрос /api/notifications из открытой вкладки:
// пока CRM ни у кого не открыта, минуты некому отсчитывать, и напоминание не приходило вообще.
// Суточный крон для этого слишком редкий, поэтому здесь отдельное расписание. Само напоминание
// по-прежнему создаётся ровно один раз — за это отвечает уникальный ключ уведомления.
//
// Защищён секретом CRON_SECRET: Vercel Cron передаёт его в заголовке Authorization.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    await connectDB();

    // Обходим фирмы с событиями-напоминаниями и фирмы с подключёнными внешними календарями:
    // проходить по всем организациям платформы каждые пять минут незачем
    const [withReminders, withCalendars] = await Promise.all([
        Event.distinct("org", { reminder: { $gt: 0 } }),
        Integration.distinct("owner", { type: { $in: ["gcal", "icloud"] }, status: "connected" }),
    ]);
    const orgs = Array.from(new Set([...withReminders, ...withCalendars].map(String)));

    let reminders = 0;
    let jobs = 0;
    for (const org of orgs.slice(0, 500)) {
        const id = String(org);
        // throttle 0: сюда мы попадаем по расписанию, а не из опроса браузера
        // Синхронизация идёт внутри обхода напоминаний; отдельный вызов здесь не нужен,
        // но для фирм без событий её всё равно надо запустить.
        // Сбой здесь иначе остался бы только в журнале Vercel, поэтому о нём сообщаем в Telegram:
        // по расписанию работает то, чего пользователь не видит и о чём сам не пожалуется
        await syncCalendars(id).catch((e) => reportError(e, { where: "синхронизация календарей по расписанию", org: id }));
        reminders += await sweepEventReminders(id, 0, 0).catch((e) => {
            void reportError(e, { where: "напоминания о событиях по расписанию", org: id });
            return 0;
        });
        jobs += await runDueJobs(id).catch((e) => {
            void reportError(e, { where: "отложенные действия автоматизации по расписанию", org: id });
            return 0;
        });
    }

    return NextResponse.json({ orgs: orgs.length, reminders, jobs });
}
