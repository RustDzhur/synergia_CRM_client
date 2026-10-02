import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { TASK_TEXT_FIELDS } from "@/lib/crmFields";
import { emit } from "@/lib/automation/emit";
import { postTask } from "@/lib/feed";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";

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

// POST /api/tasks — создать задачу
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json().catch(() => ({}));
    const fields = pickStrings(body, TASK_TEXT_FIELDS, 500);
    if (!fields.title) return NextResponse.json({ message: "Title is required" }, { status: 400 });

    const author = await prisma.user.findUnique({ where: { id: user.userId } });
    // проект и сделку проверяем на принадлежность фирме: чужой id привязывать нельзя
    const [project, deal] = await Promise.all([ownedProject(body?.project, user.id), ownedDeal(body?.deal, user.id)]);
    const task = await prisma.task.create({
        data: {
            ...(fields as any),
            owner: user.id,
            project: project?.id ?? null,
            deal: deal?.id ?? null,
            createdBy: author ? `${author.firstname} ${author.lastname}`.trim() : "",
            responsible: fields.responsible || (author ? author.firstname : ""),
        },
    });
    await postTask(user.id, user.userId, toDTO(task)); // карточка в ленте фирмы + уведомление коллегам
    await emit(user.id, { type: "task_created", data: { id: task.id, title: task.title, responsible: task.responsible ?? "" } });
    return NextResponse.json(toDTO(task), { status: 201 });
}
