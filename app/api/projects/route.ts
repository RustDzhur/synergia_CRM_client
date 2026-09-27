import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { PROJECT_TEXT_FIELDS } from "@/lib/crmFields";
import { ownedContact, ownedCompany } from "@/lib/deals";
import Project from "@/models/Project";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const STATUSES = ["planned", "active", "paused", "done"];

// Наружу проект отдаём с полем id: остальные разделы возвращают именно его, а _id документа Mongo
// в браузере неудобен — по нему не собрать ни ключ списка, ни ссылку.
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
    createdAt: p.createdAt?.toISOString?.() ?? "",
    updatedAt: p.updatedAt?.toISOString?.() ?? "",
});


// GET /api/projects[?archived=1] — проекты фирмы, новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const archived = new URL(req.url).searchParams.get("archived") === "1";
    const list = await Project.find({ owner: user.id, archived }).sort({ createdAt: -1 }).limit(300);
    return NextResponse.json(list.map(toProjectDTO));
}

// POST /api/projects — создать проект
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const fields = pickStrings(body, PROJECT_TEXT_FIELDS, 1000);
    if (!fields.name) return badRequest("Name is required");
    // статус — из закрытого списка: значение из запроса напрямую писать нельзя, схема отвергнет остальное
    if (fields.status && !STATUSES.includes(fields.status)) return badRequest("Invalid status");

    await connectDB();
    const [author, contact, company] = await Promise.all([
        User.findById(user.userId).select("firstname lastname"),
        ownedContact(body?.contact, user.id),
        ownedCompany(body?.company, user.id),
    ]);
    const project = await Project.create({
        ...fields,
        owner: user.id,
        contact: contact || undefined,
        company: company || undefined,
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    return NextResponse.json(toProjectDTO(project), { status: 201 });
}

