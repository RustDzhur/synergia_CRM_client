import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { notify } from "@/lib/notify";
import Deal from "@/models/Deal";
import Notification from "@/models/Notification";
import Task from "@/models/Task";

export const dynamic = "force-dynamic";

// GET /api/notifications — последние 50 уведомлений фирмы для этого участника и число непрочитанных
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    // отложенные действия автоматизации выполняются, пока кто-то из фирмы работает в CRM (этот запрос приходит каждые 30 секунд)
    await (await import("@/lib/automation")).runDueJobs(user.id).catch(() => undefined);
    const mine = { org: user.id, $or: [{ user: { $exists: false } }, { user: null }, { user: user.userId }] };
    const [items, unread] = await Promise.all([
        Notification.find(mine).sort({ createdAt: -1 }).limit(50),
        Notification.countDocuments({ ...mine, readBy: { $ne: user.userId } }),
    ]);
    return NextResponse.json({
        unread,
        items: items.map((n) => ({ id: String(n._id), type: n.type, params: n.params ?? {}, link: n.link, at: n.createdAt.toISOString(), read: (n.readBy ?? []).some((id: unknown) => String(id) === user.userId) })),
    });
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
    await connectDB();
    const doc = b.kind === "task" ? await Task.findOne({ _id: b.id, owner: user.id }) : await Deal.findOne({ _id: b.id, owner: user.id });
    if (!doc) return notFound();
    const title = String(b.kind === "task" ? doc.title : doc.clientName).slice(0, 120);
    const created = await notify(user.id, {
        type: "deadline",
        params: { kind: b.kind, title, stage: b.stage },
        link: b.kind === "task" ? "/crm/tasks" : "/crm/crm",
        key: `deadline:${b.kind}:${b.id}:${b.stage}:${b.kind === "task" ? doc.deadline : doc.endDate}`, // новый срок — новое уведомление
    });
    if (created) await emit(user.id, { type: "deadline", data: { kind: b.kind, title, stage: b.stage, id: String(b.id) } });
    return NextResponse.json({ created });
}
