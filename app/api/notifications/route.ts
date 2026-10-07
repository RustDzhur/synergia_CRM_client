import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { sweepEventReminders } from "@/lib/calendar/reminders";
import { unreadFor, visibleTo } from "@/lib/notify";
import { notifyDeadline, sweepDeadlines } from "@/lib/sync/deadlines";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/notifications — последние 50 уведомлений фирмы для этого участника и число непрочитанных
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    // отложенные действия автоматизации выполняются, пока кто-то из фирмы работает в CRM (этот запрос приходит каждые 30 секунд)
    await (await import("@/lib/automation")).runDueJobs(user.id).catch(() => undefined);
    // то же и для напоминаний календаря: суточный крон Vercel для минутных напоминаний слишком редок
    await sweepEventReminders(user.id, tzOffset(req)).catch(() => undefined);
    // сроки задач и сделок — тоже на сервере, адресно ответственному (lib/sync/deadlines.ts)
    await sweepDeadlines(user.id, tzOffset(req));
    const mine = visibleTo(user.id, user.userId);
    const [items, unread] = await Promise.all([
        prisma.notification.findMany({ where: mine as any, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.notification.count({ where: unreadFor(user.id, user.userId) as any }),
    ]);
    return NextResponse.json({
        unread,
        items: items.map((n) => ({ id: n.id, type: n.type, params: n.params ?? {}, link: n.link, at: n.createdAt.toISOString(), read: (n.readBy ?? []).some((id) => String(id) === user.userId) })),
    });
}

// Часовой пояс браузера в минутах от UTC — его присылает crmApi вместе с каждым опросом. События хранят
// местное время без пояса, поэтому «пора напоминать» сервер считает по местным часам пользователя.
function tzOffset(req: Request) {
    const n = Number(req.headers.get("x-tz-offset"));
    return Number.isFinite(n) ? n : 0;
}

const STAGES = ["24h", "1h", "overdue"];

// POST /api/notifications — { kind: "task" | "deal", id, stage: "24h" | "1h" | "overdue" }: приближается или прошёл срок.
// Срок задач хранится как местное время пользователя без часового пояса, поэтому «пора» определяет браузер,
// а сервер проверяет, что задача/сделка существует, и не даёт создать дубль (один раз на этап).
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || !["task", "deal"].includes(b.kind) || !validId(String(b.id)) || !STAGES.includes(b.stage)) return badRequest("Invalid notification");
    const doc = b.kind === "task" ? await prisma.task.findFirst({ where: { id: b.id, owner: user.id } }) : await prisma.deal.findFirst({ where: { id: b.id, owner: user.id } });
    if (!doc) return notFound();
    const created = await notifyDeadline(user.id, b.kind, doc as never, b.stage);
    return NextResponse.json({ created });
}
