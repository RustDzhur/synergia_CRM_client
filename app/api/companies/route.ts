import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { COMPANY_FIELDS } from "@/lib/crmFields";
import { prisma } from "@/lib/prisma";
import { toDTO, toDTOs } from "@/lib/serialize";

// GET /api/companies — список компаний-клиентов текущего пользователя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const companies = await prisma.company.findMany({ where: { owner: user.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(toDTOs(companies));
}

// POST /api/companies — создать компанию
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const fields = pickStrings(await req.json(), COMPANY_FIELDS);
    if (!fields.name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    const company = await prisma.company.create({ data: { ...(fields as any), owner: user.id } });
    return NextResponse.json(toDTO(company), { status: 201 });
}
