import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { PROJECT_TEXT_FIELDS } from "@/lib/crmFields";
import { ownedContact, ownedCompany } from "@/lib/deals";
import Project from "@/models/Project";
import Task from "@/models/Task";

export const dynamic = "force-dynamic";

const STATUSES = ["planned", "active", "paused", "done"];

// Тот же вид, что и в списке: интерфейс работает с полем id
const toProjectDTO = (p: any) => ({
    id: String(p._id),
    name: p.name,
    description: p.description ?? "",
    status: p.status ?? "planned",
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    responsible: p.responsible ?? "",
    color: p.color ?? "#34A2E8",
    contact: p.contact ? String(p.contact) : "",
    company: p.company ? String(p.company) : "",
    archived: !!p.archived,
    createdByName: p.createdByName ?? "",
});

// GET /api/projects/:id — проект вместе с его задачами
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });
    await connectDB();
    const project = await Project.findOne({ _id: params.id, owner: user.id });
    if (!project) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const tasks = await Task.find({ owner: user.id, project: project._id }).sort({ deadline: 1, createdAt: -1 });
    return NextResponse.json({ project: toProjectDTO(project), tasks });
}

// PATCH /api/projects/:id — изменить проект
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = pickStrings(body, PROJECT_TEXT_FIELDS, 1000);
    if ("name" in data && !data.name) return badRequest("Name is required");
    if (typeof data.status === "string" && !STATUSES.includes(data.status)) return badRequest("Invalid status");
    if (typeof body.archived === "boolean") data.archived = body.archived;

    await connectDB();
    // заказчика меняем только на своего: чужой контакт или фирма к проекту не привяжется
    if ("contact" in body) data.contact = (await ownedContact(body.contact, user.id))?._id;
    if ("company" in body) data.company = (await ownedCompany(body.company, user.id))?._id;

    const project = await Project.findOneAndUpdate({ _id: params.id, owner: user.id }, { $set: data }, { new: true });
    if (!project) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(toProjectDTO(project));
}

// DELETE /api/projects/:id — удалить проект. Задачи остаются: у них лишь снимается привязка,
// иначе удаление проекта уносило бы с собой сделанную работу.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    await connectDB();
    const project = await Project.findOneAndDelete({ _id: params.id, owner: user.id });
    if (!project) return NextResponse.json({ message: "Not found" }, { status: 404 });
    await Task.updateMany({ owner: user.id, project: project._id }, { $unset: { project: "" } });
    return NextResponse.json({ ok: true });
}
