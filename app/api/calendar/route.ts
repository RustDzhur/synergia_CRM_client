import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, serverError, unauthorized } from "@/lib/api";
import { appOrigin } from "@/lib/appUrl";
import { ProviderError } from "@/lib/http";
import { authorizeUrl, makeState, oauthAvailable } from "@/lib/mail/oauth";
import { findGcal } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { GCAL_SCOPE, disconnect, gcalCalendars, gcalWritable, listCalendars, setGcalCalendars, setGcalTarget, toCalendarEntries } from "@/lib/google/calendar";
import { connectIcloud, disconnectIcloud, findIcloud, icloudCalendars, setIcloudCalendars } from "@/lib/ical/icloud";
import { syncCalendars } from "@/lib/calendar/sync";
import { gcalToken } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;


// GET /api/calendar — состояние обеих интеграций: что подключено, какие календари выбраны, когда была
// последняя синхронизация и какая ошибка. Интерфейсу этого достаточно, чтобы нарисовать настройки.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();

    const [gcal, icloud] = await Promise.all([findGcal(user.id), findIcloud(user.id)]);
    return NextResponse.json({
        google: {
            available: oauthAvailable().google,
            connected: !!gcal && gcal.status === "connected",
            email: (gcal?.config as any)?.email ?? "",
            error: gcal?.error ?? "",
            lastSyncAt: gcal?.lastSyncAt?.toISOString?.() ?? "",
            calendars: gcal ? gcalCalendars(gcal) : [],
            // write: соединение выдано с правом на изменение событий. Старое подключение (только чтение)
            // писать не может — интерфейс предложит подключиться заново.
            write: gcalWritable(String((gcal?.config as any)?.scopes ?? "")),
            // Выбранный календарь для записи, а не вычисленный: пустое значение в списке означает
            // «основной», и подставлять сюда id основного нельзя — иначе выбор из списка не сохранялся бы
            target: String((gcal?.config as any)?.target ?? ""),
        },
        icloud: {
            connected: !!icloud && icloud.status === "connected",
            appleId: icloud?.config?.appleId ?? "",
            error: icloud?.error ?? "",
            lastSyncAt: icloud?.lastSyncAt?.toISOString?.() ?? "",
            calendars: icloud ? icloudCalendars(icloud) : [],
        },
    });
}

// POST /api/calendar — действия: { action: "google-start" | "icloud-connect" | "icloud-disconnect" |
// "calendars" | "sync", ... }. Подключение календарей меняет состояние интеграций, поэтому доступ
// проверяется той же охраной, что и остальные изменяющие запросы раздела.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(b.action ?? "");

    try {
        await connectDB();

        if (action === "google-start") {
            if (!oauthAvailable().google) return badRequest("Google is not configured on this site");
            // В state кладём ФИРМУ, а не пользователя: интеграция хранится по фирме (findGcal(user.id)),
            // как у Диска и рекламы, и синхронизация идёт по фирме. С id пользователя согласие проходило,
            // но подключение потом никто не находил: панель снова предлагала «Подключить».
            const locale = ["en", "de", "ua"].includes(String(b.locale)) ? String(b.locale) : "de";
            const url = authorizeUrl("google", appOrigin(req), makeState(user.id, "google", locale, "gcal"), GCAL_SCOPE);
            return NextResponse.json({ url });
        }

        if (action === "icloud-connect") {
            const result = await connectIcloud(user.id, String(b.appleId ?? ""), String(b.password ?? ""));
            await syncCalendars(user.id, { force: true }).catch(() => undefined);
            return NextResponse.json({ ok: true, ...result });
        }

        if (action === "icloud-disconnect") {
            await disconnectIcloud(user.id);
            return NextResponse.json({ ok: true });
        }

        if (action === "disconnect") {
            await disconnect(user.id);
            return NextResponse.json({ ok: true });
        }

        if (action === "calendars") {
            // выбор календарей для синхронизации; провайдер задаётся полем source
            const ids = Array.isArray(b.ids) ? b.ids.map((v) => String(v)) : [];
            if (b.source === "icloud") await setIcloudCalendars(user.id, ids);
            else await setGcalCalendars(user.id, ids);
            return NextResponse.json({ ok: true });
        }

        if (action === "target") {
            // календарь, в который записываются события, созданные в CRM
            await setGcalTarget(user.id, String(b.id ?? ""));
            return NextResponse.json({ ok: true });
        }

        if (action === "sync") {
            const result = await syncCalendars(user.id, { force: true });
            return NextResponse.json(result);
        }

        if (action === "refresh-google-calendars") {
            // Список календарей подтягиваем у Google: у пользователя их может быть много,
            // и перечислять их вручную в настройках бессмысленно
            const doc = await findGcal(user.id);
            if (!doc || doc.status !== "connected") return badRequest("Google Calendar is not connected");
            const token = await gcalToken(doc);
            const list = await listCalendars(token);
            const known = new Map(gcalCalendars(doc).map((c) => [c.id, c]));
            const entries = toCalendarEntries(list, known);
            // Календарь для записи мог исчезнуть из Google (удалён или отписались): тогда возвращаемся
            // к основному, иначе новые события падали бы с ошибкой «Not Found»
            const target = String((doc.config as any)?.target ?? "");
            await prisma.integration.update({ where: { id: doc.id }, data: { config: { ...((doc.config ?? {}) as any), calendars: entries, target: entries.some((c) => c.id === target) ? target : "" } as any } });
            // ответ отдаём по уже сохранённому списку: локальный doc.config не мутируем
            return NextResponse.json({ calendars: entries });
        }

        return badRequest("Unknown action");
    } catch (e) {
        if (e instanceof ProviderError) return badRequest(e.message);
        return serverError(e);
    }
}
