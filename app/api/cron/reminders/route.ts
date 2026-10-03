import { NextResponse } from "next/server";
import { sweepEventReminders } from "@/lib/calendar/reminders";
import { runDueJobs } from "@/lib/automation";
import { syncCalendars } from "@/lib/calendar/sync";
import { syncMarketplaces } from "@/lib/marketplace";
import { reportError } from "@/lib/reportError";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/reminders — напоминания о событиях календаря, отложенные действия автоматизации,
// синхронизация календарей и напоминания об оплате. Запускается cron сервера каждые 5 минут
// («*/5 * * * *»), поэтому напоминания минутные.
//
// Зачем отдельный маршрут. Раньше единственным «тиком» был опрос /api/notifications из открытой вкладки:
// пока CRM ни у кого не открыта, минуты некому отсчитывать, и напоминание не приходило вообще.
// Пока кто-то держит кабинет открытым, напоминания идут тем же обходом из опроса; суточный крон —
// страховка на утро, когда кабинета ещё никто не открыл, а событие уже началось. Само напоминание
// по-прежнему создаётся ровно один раз — за это отвечает уникальный ключ уведомления.
//
// Защищён секретом CRON_SECRET: cron сервера передаёт его в заголовке Authorization.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    // Обходим фирмы с событиями-напоминаниями и фирмы с подключёнными внешними календарями:
    // проходить по всем организациям платформы каждые пять минут незачем
    const [withReminders, withCalendars, withMarketplaces] = await Promise.all([
        (await prisma.event.findMany({ where: { reminder: { gt: 0 } }, select: { org: true }, distinct: ["org"] })).map((e) => e.org),
        (await prisma.integration.findMany({ where: { type: { in: ["gcal", "icloud"] }, status: "connected" }, select: { owner: true }, distinct: ["owner"] })).map((i) => i.owner),
        // Заказы площадок тянем по расписанию: пока кабинет закрыт, заявка с Prom или Rozetka
        // иначе не появилась бы в воронке до чьего-нибудь входа в CRM
        (await prisma.integration.findMany({ where: { type: { in: ["prom", "rozetka", "horoshop", "olx"] }, status: "connected" }, select: { owner: true }, distinct: ["owner"] })).map((i) => i.owner),
    ]);
    const orgs = Array.from(new Set([...withReminders, ...withCalendars, ...withMarketplaces].map(String)));

    let reminders = 0;
    let jobs = 0;
    for (const org of orgs.slice(0, 500)) {
        const id = String(org);
        // throttle 0: сюда мы попадаем по расписанию, а не из опроса браузера
        // Синхронизация идёт внутри обхода напоминаний; отдельный вызов здесь не нужен,
        // но для фирм без событий её всё равно надо запустить.
        // Сбой здесь иначе остался бы только в журнале сервера, поэтому о нём сообщаем в Telegram:
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
        // Заказы маркетплейсов: сбой одной площадки не должен останавливать остальные, поэтому
        // ошибки уже собраны внутри syncMarketplaces, а здесь только общий перехват
        await syncMarketplaces(id).catch((e) => reportError(e, { where: "заказы маркетплейсов по расписанию", org: id }));
    }

    return NextResponse.json({ orgs: orgs.length, reminders, jobs });
}
