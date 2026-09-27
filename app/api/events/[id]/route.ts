import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { eventDay, eventMinutes, eventText, eventTime, tzNameOf, tzOffsetOf, visibleEvents } from "@/lib/events";
import { ICLOUD_NOT_WRITABLE, removeExternal, syncEvent } from "@/lib/google/calendar";
import Event from "@/models/Event";

export const dynamic = "force-dynamic";

// GET /api/events/:id — одно событие, если оно видимо этому участнику
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();

    await connectDB();
    const event = await Event.findOne({ _id: params.id, ...visibleEvents(user) });
    return event ? NextResponse.json(event) : notFound();
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

    await connectDB();
    const existing = await Event.findOne({ _id: params.id, ...visibleEvents(user) }).select("source externalId");
    if (!existing) return notFound();
    // Пояс берём из запроса: событие могли перенести, находясь в другом часовом поясе, и напоминание
    // должно считаться по новому времени. Но у события из внешнего календаря пояс свой, пришедший
    // оттуда: подменить его поясом редактора — значит сдвинуть событие в Google на разницу поясов
    if (existing.source === "local" && !existing.externalId) {
        data.tzOffset = tzOffsetOf(req);
        data.tzName = tzNameOf(req);
    }

    const event = await Event.findOneAndUpdate({ _id: params.id, ...visibleEvents(user) }, { $set: data }, { new: true });
    if (!event) return notFound();
    // Правка уходит в Google: календари должны совпадать в обе стороны. Если события там ещё нет
    // (календарь подключили позже), оно создаётся. Личное событие из Google, наоборот, убираем:
    // календарь для записи общий для фирмы, и приватная встреча не должна в нём оставаться.
    const syncError = event.calendar === "my" && event.source === "google" && event.externalId
        ? await unlink(user.id, event)
        : await syncEvent(user.id, event);
    return NextResponse.json({ ...event.toObject(), ...(syncError ? { syncError } : {}) });
}

// Событие стало личным: убираем его из Google и снимаем связь. Ошибка удаления не мешает:
// связь всё равно снимается, иначе событие снова уехало бы туда при следующей правке
async function unlink(org: string, event: InstanceType<typeof Event>): Promise<string> {
    let error = "";
    try {
        await removeExternal(org, event);
    } catch (e) {
        error = e instanceof Error ? e.message : "Google Calendar did not accept the change";
    }
    await Event.updateOne({ _id: event._id }, { $unset: { externalId: "" }, $set: { source: "local", externalCalendarId: "" } });
    event.source = "local";
    event.externalId = undefined;
    event.externalCalendarId = "";
    return error;
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();

    await connectDB();
    const event = await Event.findOneAndDelete({ _id: params.id, ...visibleEvents(user) });
    if (!event) return notFound();
    // Удаляем и в Google, иначе событие вернулось бы в CRM следующей же синхронизацией. Если Google
    // не ответил, удаление всё равно состоялось, но человеку об этом говорим: событие вернётся
    // при синхронизации, и тогда его можно убрать уже в самом Google.
    // Событие из iCloud убрать оттуда нельзя — синхронизация вернёт его, и это тоже нужно сказать.
    let syncError = "";
    if (event.source === "google") {
        try {
            await removeExternal(user.id, event);
        } catch (e) {
            syncError = e instanceof Error ? e.message : "Google Calendar did not accept the deletion";
        }
    } else if (event.source === "icloud") {
        syncError = ICLOUD_NOT_WRITABLE;
    }
    return NextResponse.json({ ok: true, ...(syncError ? { syncError } : {}) });
}
