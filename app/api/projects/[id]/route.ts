import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { PROJECT_TEXT_FIELDS } from "@/lib/crmFields";
import { ownedContact, ownedCompany } from "@/lib/deals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["planned", "active", "paused", "done"];

// Тот же вид, что и в списке: интерфейс работает с полем id
const toProjectDTO = (p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    status: p.status ?? "planned",
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    responsible: p.responsible ?? "",
    color: p.color ?? "#34A2E8",
    contact: p.contact ?? "",
    company: p.company ?? "",
    archived: !!p.archived,
    createdByName: p.createdByName ?? "",
});

// GET /api/projects/:id — проект вместе с его задачами
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const project = await prisma.project.findFirst({ where: { id: params.id, owner: user.id } });
    if (!project) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const tasks = await prisma.task.findMany({ where: { owner: user.id, project: project.id }, orderBy: [{ deadline: "asc" }, { createdAt: "desc" }] });
    return NextResponse.json({ project: toProjectDTO(project), tasks });
}

// PATCH /api/projects/:id — изменить проект
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = pickStrings(body, PROJECT_TEXT_FIELDS, 1000);
    if ("name" in data && !data.name) return badRequest("Name is required");
    if (typeof data.status === "string" && !STATUSES.includes(data.status)) return badRequest("Invalid status");
    if (typeof body.archived === "boolean") data.archived = body.archived;

    // заказчика меняем только на своего: чужой контакт или фирма к проекту не привяжется
    if ("contact" in body) data.contact = (await ownedContact(body.contact, user.id)) ?? undefined;
    if ("company" in body) data.company = (await ownedCompany(body.company, user.id)) ?? undefined;

    const existing = await prisma.project.findFirst({ where: { id: params.id, owner: user.id } });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const project = await prisma.project.update({ where: { id: params.id }, data: data as any });
    return NextResponse.json(toProjectDTO(project));
}

// DELETE /api/projects/:id — удалить проект. Задачи остаются: у них лишь снимается привязка,
// иначе удаление проекта уносило бы с собой сделанную работу.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const r = await prisma.project.deleteMany({ where: { id: params.id, owner: user.id } });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });
    await prisma.task.updateMany({ where: { owner: user.id, project: params.id }, data: { project: null } });
    return NextResponse.json({ ok: true });
}
