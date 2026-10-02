import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { EMPLOYEE_FIELDS } from "@/lib/crmFields";
import { prisma } from "@/lib/prisma";
import { toDTO, toDTOs } from "@/lib/serialize";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").slice(0, 100).trim(); // поиск — это текст, а не шаблон регулярного выражения
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const limit = 20;
    const filter: Record<string, unknown> = { owner: user.id };
    if (q) filter.OR = [
        { firstname: { contains: q, mode: "insensitive" } },
        { lastname: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
    ];
    // Фильтры по подразделению и должности — точным совпадением: это не поиск по тексту,
    // а выбор из значений, которые уже есть в справочнике
    const department = (searchParams.get("department") ?? "").slice(0, 100);
    const position = (searchParams.get("position") ?? "").slice(0, 100);
    if (department) filter.department = department;
    if (position) filter.position = position;
    const [items, total] = await Promise.all([
        prisma.employee.findMany({ where: filter as any, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.employee.count({ where: filter as any }),
    ]);
    return NextResponse.json({ items: toDTOs(items), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const data = pickStrings(await req.json(), EMPLOYEE_FIELDS);
    if (!data.firstname || !data.lastname || !data.email) {
        return NextResponse.json({ message: "Invalid data" }, { status: 400 });
    }
    const employee = await prisma.employee.create({ data: { ...(data as any), owner: user.id } });
    return NextResponse.json(toDTO(employee), { status: 201 });
}
