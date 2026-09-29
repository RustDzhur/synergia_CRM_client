import { notify } from "@/lib/notify";
import { emailReminder } from "@/lib/notifyEmail";
import Event from "@/models/Event";
import Membership from "@/models/Membership";
import { syncCalendars } from "@/lib/calendar/sync";

// Напоминания о событиях календаря. Своего расписания на каждую минуту у сервера нет: Vercel Cron ходит
// раз в сутки (vercel.json) и для минутных напоминаний не годится. Поэтому обход выполняется там же, где
// отложенные действия автоматизации, — в GET /api/notifications, который CRM опрашивает каждые 30 секунд,
// пока кто-то из фирмы держит её открытой. Если CRM не открыта ни у кого, напоминание о событии не придёт.

// Время события хранится как местное время пользователя без часового пояса (date + startTime), поэтому
// браузер вместе с опросом присылает свой сдвиг от UTC (заголовок X-Tz-Offset в минутах). Все времена
// сравниваются «настенными»: время события — как если бы оно было UTC, «сейчас» — как местное время браузера.

// Насколько поздно напоминание ещё считается нужным. Раньше окно было пять минут, и напоминание,
// пропущенное из-за закрытой CRM или задержки планировщика, терялось навсегда. Теперь верхняя граница —
// окончание события: пока событие ещё идёт (или только началось), напомнить о нём осмысленно.
// Пачки уведомлений при этом не будет: ключ уведомления уникален по событию, времени начала и величине
// напоминания, поэтому повторный обход создаёт запись ровно один раз.
const THROTTLE_MS = 20_000;
// Ниже этого предела событие считается прошедшим и не напоминает о себе
const MIN_TAIL_MS = 60 * 60_000; // час после окончания — на случай события без указанного конца

const lastRun = new Map<string, number>();

// Сколько уведомлений создано в этом обходе. Уже созданное не повторяется: ключ уведомления включает
// событие, его начало и величину напоминания (см. unique-индекс Notification {org, key}).
export async function sweepEventReminders(org: string, tzOffsetMinutes = 0, throttleMs = THROTTLE_MS) {
    if (throttleMs > 0) {
        if (Date.now() - (lastRun.get(org) ?? 0) < throttleMs) return 0;
        lastRun.set(org, Date.now());
    }
    // Внешние календари подтягиваем до выборки: события, пришедшие из Google или iCloud, должны
    // попасть в этот же обход, а не в следующий. Внутри стоит своя пауза, поэтому частый вызов
    // здесь ничего не стоит.
    await syncCalendars(org).catch(() => undefined);

    // Запасной пояс — для событий, созданных до того, как пояс стали хранить вместе с событием.
    // Дальше у каждого события используется его собственный пояс: напоминание не должно зависеть
    // от того, чей браузер в этот момент опрашивает сервер.
    const fallback = Math.max(-840, Math.min(840, Math.round(tzOffsetMinutes)));
    // окно поиска берём с запасом в двое суток: у событий разные пояса, а дата — строка "YYYY-MM-DD"
    const dayFrom = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    const dayTo = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const events = await Event.find({ org, reminder: { $gt: 0 }, date: { $gte: dayFrom, $lte: dayTo } })
        .select("title description date startTime endDate endTime reminder calendar createdBy location tzOffset");

    let sent = 0;
    for (const event of events) {
        const startWall = Date.parse(`${event.date}T${event.startTime}:00Z`);
        if (!Number.isFinite(startWall)) continue;
        // конец события: если он не указан, считаем событие часовым
        const endWallRaw = Date.parse(`${event.endDate || event.date}T${event.endTime || event.startTime}:00Z`);
        const endWall = Number.isFinite(endWallRaw) && endWallRaw > startWall ? endWallRaw : startWall + MIN_TAIL_MS;

        // «Сейчас» в поясе самого события
        const offset = typeof event.tzOffset === "number" && Number.isFinite(event.tzOffset) ? event.tzOffset : fallback;
        const nowWall = Date.now() + offset * 60_000;

        // напоминаем, когда время напоминания уже наступило, а событие ещё не закончилось
        if (nowWall < startWall - event.reminder * 60_000) continue;
        if (nowWall > endWall + MIN_TAIL_MS) continue;

        // личное событие напоминает только автору, общее — всей фирме
        if (event.calendar === "my" && !event.createdBy) continue;
        const created = await notify(org, {
            type: "event",
            params: { title: String(event.title).slice(0, 120), at: moment(event.date, event.startTime) },
            link: "/crm/collaboration/calendar",
            key: `event-reminder:${String(event._id)}:${event.date}T${event.startTime}:${event.reminder}`,
            ...(event.calendar === "my" ? { user: String(event.createdBy) } : {}),
        });
        if (!created) continue;
        sent++;

        // То же напоминание письмом: письмо дойдёт, даже если CRM закрыта. Уходит только тем,
        // у кого в профиле включены письма; ящик фирмы при этом должен быть подключён (lib/notifyEmail.ts).
        const recipients = event.calendar === "my" && event.createdBy ? [String(event.createdBy)] : await orgUserIds(org);
        const when = moment(event.date, event.startTime);
        for (const id of recipients) {
            await emailReminder(org, id, `Termin: ${String(event.title).slice(0, 120)}`, [
                `${String(event.title)}`,
                `Beginn: ${when}`,
                event.location ? `Ort: ${event.location}` : "",
                event.description ? `\n${event.description}` : "",
                "",
                "Diese Erinnerung wurde in Firmspace AI erstellt.",
            ].filter(Boolean).join("\n"), tzOffsetMinutes);
        }
    }
    return sent;
}

// Кому писать письмо по общему событию: всем, у кого есть доступ к фирме. Обычно это несколько человек,
// и каждый сам решает в профиле, хочет он письма или нет — фильтр внутри emailReminder.
async function orgUserIds(org: string): Promise<string[]> {
    const members = await Membership.find({ org }).select("user").limit(200);
    return members.map((m) => String(m.user));
}

// «27.09.2026 14:30» — читается одинаково во всех трёх языках интерфейса
function moment(date: string, time: string) {
    const [y, m, d] = date.split("-");
    return `${d}.${m}.${y} ${time}`;
}
