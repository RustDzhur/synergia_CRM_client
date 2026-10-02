import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { EVENT_SOURCES, eventDay, eventMinutes, eventText, eventTime, tzNameOf, tzOffsetOf, visibleEvents } from "@/lib/events";
import { syncEvent } from "@/lib/google/calendar";
import { prisma } from "@/lib/prisma";
import { toDTO, toDTOs } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/events — события календаря, которые видит этот участник: свои личные и все общие события фирмы
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const events = await prisma.event.findMany({ where: visibleEvents(user) as any, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
    return NextResponse.json(toDTOs(events));
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

    const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
    const source = (EVENT_SOURCES as readonly string[]).includes(String(b.source)) ? String(b.source) : "local";
    const externalId = eventText(b.externalId, 200);
    if (externalId) {
        const existing = await prisma.event.findFirst({ where: { org: user.id, source, externalId } });
        if (existing) return NextResponse.json(toDTO(existing));
    }
    let event = await prisma.event.create({
        data: {
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
            tzOffset: tzOffsetOf(req),
            tzName: tzNameOf(req),
            source,
            ...(externalId ? { externalId } : {}),
            createdBy: user.userId,
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    // Событие, созданное здесь, записываем и в календарь Google (если он подключён): календари
    // должны совпадать в обе стороны, иначе человек не увидит событие в телефоне.
    // Перенос старых событий из localStorage связь уже несёт — их не трогаем.
    const sync = externalId ? { error: "" } : await syncEvent(user.id, event as any);
    if (sync.source) {
        event = await prisma.event.update({ where: { id: event.id }, data: { source: sync.source, externalId: sync.externalId ?? null, externalCalendarId: sync.externalCalendarId ?? "" } });
    }
    return NextResponse.json({ ...toDTO(event), ...(sync.error ? { syncError: sync.error } : {}) }, { status: 201 });
}
