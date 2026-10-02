import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { ensureStages } from "@/lib/stages";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";

// GET /api/stages — список стадий текущего пользователя (создаёт дефолтные, если их ещё нет)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const stages = await ensureStages(user.id);

    return NextResponse.json(stages);
}

// POST /api/stages — добавить новую колонку (кнопка "+" в конце доски, если есть в макете)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const { name } = await req.json();
    const count = await prisma.stage.count({ where: { owner: user.id } });
    const stage = await prisma.stage.create({ data: { owner: user.id, name: name || "New stage", order: count } });

    return NextResponse.json(toDTO(stage), { status: 201 });
}
