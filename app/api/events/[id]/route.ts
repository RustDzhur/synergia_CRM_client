import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { eventDay, eventMinutes, eventText, eventTime, tzNameOf, tzOffsetOf, visibleEvents } from "@/lib/events";
import { ICLOUD_NOT_WRITABLE, removeExternal, syncEvent } from "@/lib/google/calendar";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/events/:id — одно событие, если оно видимо этому участнику
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();

    const event = await prisma.event.findFirst({ where: { id: params.id, ...visibleEvents(user) } as any });
    return event ? NextResponse.json(toDTO(event)) : notFound();
}

// PATCH /api/events/:id — правка события. Принимаются только присланные поля; личные события правит
// только автор, общие (company) — любой участник фирмы, который их видит (так же, как в интерфейсе).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();

    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof b.title === "string") {
        const title = eventText(b.title, 200);
        if (!title) return badRequest("Title is required");
        data.title = title;
    }
    if (typeof b.description === "string") data.description = eventText(b.description, 2000);
    if (typeof b.color === "string") data.color = eventText(b.color, 20);
    if (b.calendar === "my" || b.calendar === "company") data.calendar = b.calendar;
    if (typeof b.date === "string") {
        const date = eventDay(b.date);
        if (!date) return badRequest("Invalid date");
        data.date = date;
    }
    if (typeof b.startTime === "string") data.startTime = eventTime(b.startTime);
    if (typeof b.endDate === "string") data.endDate = eventDay(b.endDate);
    if (typeof b.endTime === "string") data.endTime = eventTime(b.endTime);
    if (typeof b.attendees === "string") data.attendees = eventText(b.attendees, 200);
    if (typeof b.location === "string") data.location = eventText(b.location, 200);
    if (b.reminder !== undefined) data.reminder = eventMinutes(b.reminder);

    const existing = await prisma.event.findFirst({ where: { id: params.id, ...visibleEvents(user) } as any, select: { source: true, externalId: true } });
    if (!existing) return notFound();
    // Пояс берём из запроса: событие могли перенести, находясь в другом часовом поясе, и напоминание
    // должно считаться по новому времени. Но у события из внешнего календаря пояс свой, пришедший
    // оттуда: подменить его поясом редактора — значит сдвинуть событие в Google на разницу поясов
    if (existing.source === "local" && !existing.externalId) {
        data.tzOffset = tzOffsetOf(req);
        data.tzName = tzNameOf(req);
    }

    let event = await prisma.event.update({ where: { id: params.id }, data: data as any });
    // Правка уходит в Google: календари должны совпадать в обе стороны. Если события там ещё нет
    // (календарь подключили позже), оно создаётся. Личное событие из Google, наоборот, убираем:
    // календарь для записи общий для фирмы, и приватная встреча не должна в нём оставаться.
    let syncError = "";
    if (event.calendar === "my" && event.source === "google" && event.externalId) {
        syncError = await unlink(user.id, event);
        event = { ...event, source: "local", externalId: null, externalCalendarId: "" };
    } else {
        const sync = await syncEvent(user.id, event as any);
        syncError = sync.error;
        if (sync.source) {
            event = await prisma.event.update({ where: { id: params.id }, data: { source: sync.source, externalId: sync.externalId ?? null, externalCalendarId: sync.externalCalendarId ?? "" } });
        }
    }
    return NextResponse.json({ ...toDTO(event), ...(syncError ? { syncError } : {}) });
}

// Событие стало личным: убираем его из Google и снимаем связь. Ошибка удаления не мешает:
// связь всё равно снимается, иначе событие снова уехало бы туда при следующей правке
async function unlink(org: string, event: { id: string; externalId?: string | null; externalCalendarId?: string }): Promise<string> {
    let error = "";
    try {
        await removeExternal(org, event as any);
    } catch (e) {
        error = e instanceof Error ? e.message : "Google Calendar did not accept the change";
    }
    await prisma.event.update({ where: { id: event.id }, data: { externalId: null, source: "local", externalCalendarId: "" } });
    return error;
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();

    const event = await prisma.event.findFirst({ where: { id: params.id, ...visibleEvents(user) } as any });
    if (!event) return notFound();
    await prisma.event.delete({ where: { id: params.id } });
    // Удаляем и в Google, иначе событие вернулось бы в CRM следующей же синхронизацией.
    let syncError = "";
    if (event.source === "google") {
        try {
            await removeExternal(user.id, event as any);
        } catch (e) {
            syncError = e instanceof Error ? e.message : "Google Calendar did not accept the deletion";
        }
    } else if (event.source === "icloud") {
        syncError = ICLOUD_NOT_WRITABLE;
    }
    return NextResponse.json({ ok: true, ...(syncError ? { syncError } : {}) });
}
