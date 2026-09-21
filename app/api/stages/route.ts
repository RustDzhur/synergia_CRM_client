import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { ensureStages } from "@/lib/stages";
import Stage from "@/models/Stage";

// GET /api/stages — список стадий текущего пользователя (создаёт дефолтные, если их ещё нет)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const stages = await ensureStages(user.id);

    return NextResponse.json(stages);
}

// POST /api/stages — добавить новую колонку (кнопка "+" в конце доски, если есть в макете)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { name } = await req.json();
    await connectDB();
    const count = await Stage.countDocuments({ owner: user.id });
    const stage = await Stage.create({ owner: user.id, name: name || "New stage", order: count });

    return NextResponse.json(stage, { status: 201 });
}