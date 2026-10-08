import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { TASK_TEXT_FIELDS } from "@/lib/crmFields";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { emit } from "@/lib/automation/emit";
import { notify } from "@/lib/notify";
import { ownedCompany, ownedContact, ownedDeal } from "@/lib/deals";
import { logActivity } from "@/lib/sync/feed";
import { resolveResponsible } from "@/lib/sync/people";
import { fx } from "@/lib/sync/texts";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = pickStrings(body, TASK_TEXT_FIELDS, 500);
    if ("title" in data && !data.title) return NextResponse.json({ message: "Title is required" }, { status: 400 });
    for (const flag of ["completed", "pinned", "muted"] as const) {
        if (typeof body[flag] === "boolean") data[flag] = body[flag];
    }

    // привязку к проекту проверяем отдельно: чужой проект привязать нельзя, а пустая строка снимает привязку
    if ("project" in body) {
        const id = body.project;
        if (typeof id === "string" && id) {
            const owned = await prisma.project.findFirst({ where: { id, owner: user.id }, select: { id: true } }).catch(() => null);
            if (!owned) return NextResponse.json({ message: "Project not found" }, { status: 400 });
            data.project = owned.id;
        } else {
            data.project = null;
        }
    }
    const existing = await prisma.task.findUnique({ where: { id: params.id } });
    if (!existing || existing.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });

    // Привязка к сделке, контакту и фирме: чужой id привязать нельзя, пустое значение снимает связь
    for (const [key, check] of [["deal", ownedDeal], ["contact", ownedContact], ["company", ownedCompany]] as const) {
        if (!(key in body)) continue;
        const v = body[key];
        if (typeof v === "string" && v) {
            const owned = await check(v, user.id);
            if (!owned) return NextResponse.json({ message: `${key} not found` }, { status: 400 });
            data[key] = owned;
        } else {
            data[key] = null;
        }
    }
    // «ответственный» вводится словами; сопоставляем его с участником фирмы (адресные уведомления)
    if (typeof body.responsible === "string") data.responsibleUser = await resolveResponsible(user.id, body.responsible);

    const justCompleted = data.completed === true && !existing.completed;
    const reopened = data.completed === false && existing.completed;
    if (justCompleted) data.completedAt = new Date();
    if (reopened) data.completedAt = null;

    const task = await prisma.task.update({ where: { id: params.id }, data: data as any });

    // выполнение задачи видно во всех карточках, где она показана, и доходит до автора
    if (justCompleted || reopened) {
        const who = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const name = who ? `${who.firstname} ${who.lastname}`.trim() : "";
        await logActivity(user.id, { deal: task.deal, contact: task.contact, company: task.company }, {
            type: "task", text: justCompleted ? (name ? fx("task_done_by", { title: task.title, actor: name }) : fx("task_done", { title: task.title })) : fx("task_reopened", { title: task.title }), meta: `task:${task.id}`, key: `task-${justCompleted ? "done" : "reopen"}:${task.id}:${Date.now()}`,
        });
        if (justCompleted) {
            await emit(user.id, { type: "task_completed", data: { id: task.id, title: task.title, responsible: task.responsible ?? "", dealId: task.deal ?? "" } });
            if (task.createdByUser && task.createdByUser !== user.userId) {
                await notify(user.id, { type: "team", params: { name, text: fx("notif_task_done", { title: task.title.slice(0, 100) }) }, link: "/crm/tasks", key: `task-done:${task.id}`, user: task.createdByUser });
            }
        }
    }
    // задачу передали другому человеку
    if (data.responsibleUser && data.responsibleUser !== existing.responsibleUser && data.responsibleUser !== user.userId) {
        await notify(user.id, { type: "team", params: { name: task.createdBy || "—", text: fx("notif_task_assigned", { title: task.title.slice(0, 100) }) }, link: "/crm/tasks", key: `task-assigned:${task.id}:${data.responsibleUser}`, user: data.responsibleUser });
    }
    return NextResponse.json(toDTO(task));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const r = await prisma.task.deleteMany({ where: { id: params.id, owner: user.id } });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
