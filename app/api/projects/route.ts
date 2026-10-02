import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { PROJECT_TEXT_FIELDS } from "@/lib/crmFields";
import { ownedContact, ownedCompany } from "@/lib/deals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["planned", "active", "paused", "done"];

// Наружу проект отдаём с полем id: остальные разделы возвращают именно его.
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
    createdAt: p.createdAt?.toISOString?.() ?? "",
    updatedAt: p.updatedAt?.toISOString?.() ?? "",
});

// GET /api/projects[?archived=1] — проекты фирмы, новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const archived = new URL(req.url).searchParams.get("archived") === "1";
    const list = await prisma.project.findMany({ where: { owner: user.id, archived }, orderBy: { createdAt: "desc" }, take: 300 });
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

    const [author, contact, company] = await Promise.all([
        prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } }),
        ownedContact(body?.contact, user.id),
        ownedCompany(body?.company, user.id),
    ]);
    const project = await prisma.project.create({
        data: {
            ...(fields as any),
            owner: user.id,
            contact: contact ?? undefined,
            company: company ?? undefined,
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    return NextResponse.json(toProjectDTO(project), { status: 201 });
}
