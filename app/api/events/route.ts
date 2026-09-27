import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { EVENT_SOURCES, eventDay, eventMinutes, eventText, eventTime, tzNameOf, tzOffsetOf, visibleEvents } from "@/lib/events";
import { syncEvent } from "@/lib/google/calendar";
import Event from "@/models/Event";
import User from "@/models/User";


export const dynamic = "force-dynamic";

// GET /api/events — события календаря, которые видит этот участник: свои личные и все общие события фирмы
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    await connectDB();
    const events = await Event.find(visibleEvents(user)).sort({ date: 1, startTime: 1 });
    return NextResponse.json(events);
}

// POST /api/events — создать событие. source и externalId присылает только перенос старых событий
// из localStorage (useCollabStore): повтор с тем же externalId не создаёт дубль, а возвращает уже
// сохранённое событие. События из внешних календарей пишет синхронизация напрямую
// (lib/calendar/sources.ts), а не через этот маршрут.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = eventText(b.title, 200);
    if (!title) return badRequest("Title is required");
    const date = eventDay(b.date);
    if (!date) return badRequest("Date is required");

    await connectDB();
    const author = await User.findById(user.userId).select("firstname lastname");
    const source = (EVENT_SOURCES as readonly string[]).includes(String(b.source)) ? String(b.source) : "local";
    const externalId = eventText(b.externalId, 200);
    if (externalId) {
        const existing = await Event.findOne({ org: user.id, source, externalId });
        if (existing) return NextResponse.json(existing);
    }
    const event = await Event.create({
        org: user.id,
        title,
        description: eventText(b.description, 2000),
        color: eventText(b.color, 20),
        calendar: b.calendar === "company" ? "company" : "my",
        date,
        startTime: eventTime(b.startTime, "09:00"),
        endDate: eventDay(b.endDate, date),
        endTime: eventTime(b.endTime, "10:00"),
        attendees: eventText(b.attendees, 200),
        location: eventText(b.location, 200),
        reminder: eventMinutes(b.reminder),
        // Пояс автора: браузер присылает сдвиг заголовком X-Tz-Offset, а имя пояса — X-Tz-Name
        // (см. app/store/crmApi.ts). Имя нужно для записи в Google: сдвиг верен только на сегодня
        tzOffset: tzOffsetOf(req),
        tzName: tzNameOf(req),
        source,
        ...(externalId ? { externalId } : {}),
        createdBy: user.userId,
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    // Событие, созданное здесь, записываем и в календарь Google (если он подключён): календари
    // должны совпадать в обе стороны, иначе человек не увидит событие в телефоне.
    // Перенос старых событий из localStorage связь уже несёт — их не трогаем.
    const syncError = externalId ? "" : await syncEvent(user.id, event);
    return NextResponse.json({ ...event.toObject(), ...(syncError ? { syncError } : {}) }, { status: 201 });
}
