import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { emit } from "@/lib/automation/emit";
import { deadlineStage } from "@/utils/deadline";
import { recordSyncError } from "@/lib/sync/errors";

// Сроки задач и сделок. Раньше уведомление «срок близко» создавал браузер, когда страница открыта: если у ответственного
// кабинет закрыт, ничего не приходило, а уведомление получала вся фирма. Теперь обход делает сервер при каждом опросе
// (и это работает для любого открытого кабинета фирмы), а адресат — ответственный, если он известен.

export type DeadlineKind = "task" | "deal";
type Stage = "24h" | "1h" | "overdue";

export async function notifyDeadline(org: string, kind: DeadlineKind, doc: { id: string; title?: string; clientName?: string; deadline?: string; endDate?: string; responsibleUser?: string | null }, stage: Stage) {
    const title = String(kind === "task" ? doc.title : doc.clientName).slice(0, 120);
    const date = kind === "task" ? doc.deadline : doc.endDate;
    const created = await notify(org, {
        type: "deadline",
        params: { kind, title, stage },
        link: kind === "task" ? "/crm/tasks" : "/crm/crm",
        key: `deadline:${kind}:${doc.id}:${stage}:${date}`, // новый срок — новое уведомление
        ...(doc.responsibleUser ? { user: doc.responsibleUser } : {}),
    });
    if (created) await emit(org, { type: "deadline", data: { kind, title, stage, id: String(doc.id) } });
    return created;
}

const lastRun = new Map<string, number>();

// Обход сроков. «Сейчас» считается по часам пользователя (сдвиг от UTC приходит заголовком X-Tz-Offset): срок задачи
// хранится как местное время без пояса.
export async function sweepDeadlines(org: string, tzOffsetMinutes = 0, throttleMs = 20_000): Promise<number> {
    if (throttleMs > 0) {
        if (Date.now() - (lastRun.get(org) ?? 0) < throttleMs) return 0;
        lastRun.set(org, Date.now());
    }
    const nowWall = Date.now() + Math.max(-840, Math.min(840, Math.round(tzOffsetMinutes))) * 60_000;
    let created = 0;
    try {
        const [tasks, deals] = await Promise.all([
            prisma.task.findMany({ where: { owner: org, completed: false, muted: false, deadline: { not: "" } }, select: { id: true, title: true, deadline: true, responsibleUser: true } }),
            prisma.deal.findMany({ where: { owner: org, wonAt: null, endDate: { not: "" } }, select: { id: true, clientName: true, endDate: true, responsibleUser: true } }),
        ]);
        const wall = (text: string, dateOnly: boolean) => Date.parse(dateOnly ? `${text}T23:59:00Z` : `${text}:00Z`);
        for (const t of tasks) {
            const stage = deadlineStage(wall(t.deadline, t.deadline.length <= 10), nowWall);
            if (stage && (await notifyDeadline(org, "task", t, stage))) created++;
        }
        for (const d of deals) {
            const stage = deadlineStage(wall(d.endDate, d.endDate.length <= 10), nowWall);
            if (stage && (await notifyDeadline(org, "deal", d, stage))) created++;
        }
    } catch (e) {
        await recordSyncError(org, "deadlines.sweep", e);
    }
    return created;
}
