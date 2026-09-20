import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import Stage from "@/models/Stage";

const DEFAULT_STAGE_COUNT = 6; // столько колонок в макете по умолчанию

// GET /api/stages — список стадий текущего пользователя (создаёт дефолтные, если их ещё нет)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    let stages = await Stage.find({ owner: user.id }).sort({ order: 1 });

    // первый заход пользователя в CRM — создаём 6 пустых колонок, как в макете
    if (stages.length === 0) {
        const DEFAULT_NAMES = ["New Lead", "Contacted", "Qualified", "Proposal", "Negotiation", "Won"];
        const toCreate = DEFAULT_NAMES.map((name, i) => ({
            owner: user.id,
            name,
            order: i,
        }));
        stages = await Stage.insertMany(toCreate);
    }

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