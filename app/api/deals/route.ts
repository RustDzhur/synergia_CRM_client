import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { DEAL_TEXT_FIELDS } from "@/lib/crmFields";
import { emitDeal } from "@/lib/automation/emit";
import { ownedContact, ownedCompany } from "@/lib/deals";
import Deal from "@/models/Deal";
import Stage from "@/models/Stage";

// GET /api/deals — все сделки текущего пользователя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    await connectDB();
    const deals = await Deal.find({ owner: user.id }).sort({ order: 1 });
    return NextResponse.json(deals);
}

// POST /api/deals — добавить сделку в колонку (кнопка "Add" в макете)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json();
    const clientName = typeof body.clientName === "string" ? body.clientName.trim().slice(0, 200) : "";
    if (!body.stage || !clientName) {
        return NextResponse.json({ message: "stage and clientName are required" }, { status: 400 });
    }
    if (!isValidObjectId(body.stage)) return NextResponse.json({ message: "Invalid stage" }, { status: 400 });

    await connectDB();
    const stage = await Stage.findOne({ _id: body.stage, owner: user.id });
    if (!stage) return NextResponse.json({ message: "Stage not found" }, { status: 404 });

    const [contact, company] = await Promise.all([ownedContact(body.contact, user.id), ownedCompany(body.company, user.id)]);
    const count = await Deal.countDocuments({ owner: user.id, stage: stage._id });
    const deal = await Deal.create({
        ...pickStrings(body, DEAL_TEXT_FIELDS),
        owner: user.id,
        stage: stage._id,
        clientName,
        contact: contact || undefined,
        company: company || undefined,
        order: count,
        activities: [{ type: "created", text: clientName }],
    });

    await emitDeal(user.id, deal, "deal_created");
    return NextResponse.json(deal, { status: 201 });
}
