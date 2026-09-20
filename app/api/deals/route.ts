import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import Deal from "@/models/Deal";

// GET /api/deals — все сделки текущего пользователя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const deals = await Deal.find({ owner: user.id }).sort({ order: 1 });
    return NextResponse.json(deals);
}

// POST /api/deals — добавить карточку в колонку (кнопка "+ Add" в макете)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { stage, clientName } = await req.json();
    if (!stage || !clientName) {
        return NextResponse.json({ message: "stage and clientName are required" }, { status: 400 });
    }

    await connectDB();
    const count = await Deal.countDocuments({ owner: user.id, stage });
    const deal = await Deal.create({ owner: user.id, stage, clientName, order: count });

    return NextResponse.json(deal, { status: 201 });
}