import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { TASK_TEXT_FIELDS } from "@/lib/crmFields";
import { emit } from "@/lib/automation/emit";
import { postTask } from "@/lib/feed";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { notify } from "@/lib/notify";
import { ownedCompany, ownedContact } from "@/lib/deals";
import { logActivity } from "@/lib/sync/feed";
import { resolveResponsible } from "@/lib/sync/people";
import { fx } from "@/lib/sync/texts";

// Проект задачи: возвращаем только свой — чужой id из запроса игнорируем
async function ownedProject(id: unknown, org: string) {
    if (typeof id !== "string" || !id) return null;
    return prisma.project.findFirst({ where: { id, owner: org }, select: { id: true } }).catch(() => null);
}

// Сделка, из карточки которой поставлена задача: тоже только своя
async function ownedDeal(id: unknown, org: string) {
    if (typeof id !== "string" || !id) return null;
    return prisma.deal.findFirst({ where: { id, owner: org }, select: { id: true, clientName: true } }).catch(() => null);
}

// GET /api/tasks — все задачи текущего пользователя (ближайшие сроки первыми)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const tasks = await prisma.task.findMany({ where: { owner: user.id }, orderBy: [{ deadline: "asc" }, { createdAt: "desc" }] });
    // у задач из карточки сделки отдаём её название: в списке задач по нему видно, откуда задача пришла
    const dealIds = tasks.map((t) => t.deal).filter((d): d is string => !!d);
    const deals = await prisma.deal.findMany({ where: { owner: user.id, id: { in: dealIds } }, select: { id: true, clientName: true } });
    const names = new Map(deals.map((d) => [d.id, String(d.clientName ?? "")]));
    return NextResponse.json(tasks.map((t) => ({ ...toDTO(t), dealName: t.deal ? names.get(t.deal) ?? "" : "" })));
}

// POST /api/tasks — создать задачу. Привязка к сделке, контакту и фирме проверяется на принадлежность фирме; задача из
// карточки сделки наследует контакт и фирму сделки, поэтому видна и в карточке клиента.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json().catch(() => ({}));
    const fields = pickStrings(body, TASK_TEXT_FIELDS, 500);
    if (!fields.title) return NextResponse.json({ message: "Title is required" }, { status: 400 });

    const author = await prisma.user.findUnique({ where: { id: user.userId } });
    // проект и сделку проверяем на принадлежность фирме: чужой id привязывать нельзя
    const [project, deal, contactId, companyId] = await Promise.all([ownedProject(body?.project, user.id), ownedDeal(body?.deal, user.id), ownedContact(body?.contact, user.id), ownedCompany(body?.company, user.id)]);
    const dealDoc = deal ? await prisma.deal.findFirst({ where: { id: deal.id, owner: user.id }, select: { contact: true, company: true } }) : null;
    const responsible = fields.responsible || (author ? author.firstname : "");
    const responsibleUser = fields.responsible ? await resolveResponsible(user.id, fields.responsible) : user.userId;
    const task = await prisma.task.create({
        data: {
            ...(fields as any),
            owner: user.id,
            project: project?.id ?? null,
            deal: deal?.id ?? null,
            contact: contactId ?? dealDoc?.contact ?? null,
            company: companyId ?? dealDoc?.company ?? null,
            createdBy: author ? `${author.firstname} ${author.lastname}`.trim() : "",
            createdByUser: user.userId,
            responsible,
            responsibleUser,
        },
    });
    await postTask(user.id, user.userId, toDTO(task), responsibleUser); // карточка в ленте фирмы + уведомление коллегам
    // ответственному, если это другой человек, — личное уведомление
    if (responsibleUser && responsibleUser !== user.userId) {
        await notify(user.id, { type: "team", params: { name: task.createdBy || "—", text: fx("notif_task_assigned", { title: task.title.slice(0, 100) }) }, link: "/crm/tasks", key: `task-assigned:${task.id}:${responsibleUser}`, user: responsibleUser });
    }
    await logActivity(user.id, { deal: task.deal, contact: task.contact, company: task.company }, { type: "task", text: task.deadline ? fx("task_created_due", { title: task.title, due: task.deadline.replace("T", " ") }) : fx("task_created", { title: task.title }), meta: `task:${task.id}`, key: `task-created:${task.id}` });
    await emit(user.id, { type: "task_created", data: { id: task.id, title: task.title, responsible: task.responsible ?? "", dealId: task.deal ?? "" } });
    return NextResponse.json(toDTO(task), { status: 201 });
}
