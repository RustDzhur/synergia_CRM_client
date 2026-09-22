import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { emitDeal } from "@/lib/automation/emit";
import { ownedContact, ownedCompany } from "@/lib/deals";
import Deal from "@/models/Deal";
import Stage from "@/models/Stage";
import { DEAL_TEXT_FIELDS } from "@/lib/crmFields";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json(); // любое из: stage, order, clientName, contactName, ..., availableToAll
    // только разрешённые поля: иначе через PATCH можно было записать в документ что угодно
    const data: Record<string, unknown> = pickStrings(body, DEAL_TEXT_FIELDS);
    if (typeof body.clientName === "string") {
        if (!body.clientName.trim()) return NextResponse.json({ message: "clientName is required" }, { status: 400 });
        data.clientName = body.clientName.trim().slice(0, 200);
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) data.order = body.order;
    if (typeof body.availableToAll === "boolean") data.availableToAll = body.availableToAll;

    await connectDB();
    const existing = await Deal.findOne({ _id: params.id, owner: user.id });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

    // "contact"/"company" присланы явно (даже пустой строкой — значит "отвязать") — undefined значит "не трогать"
    if (body.contact !== undefined) data.contact = await ownedContact(body.contact, user.id);
    if (body.company !== undefined) data.company = await ownedCompany(body.company, user.id);

    const update: Record<string, unknown> = {};
    if (body.stage !== undefined) {
        if (!isValidObjectId(body.stage)) return NextResponse.json({ message: "Invalid stage" }, { status: 400 });
        const stage = await Stage.findOne({ _id: body.stage, owner: user.id });
        if (!stage) return NextResponse.json({ message: "Stage not found" }, { status: 404 });
        data.stage = stage._id;
        // смена стадии попадает в ленту активности сделки автоматически (перенос карточкой и выбор в форме)
        if (String(existing.stage) !== String(stage._id)) {
            update.$push = { activities: { type: "stage", text: stage.name } };
        }
    }
    update.$set = data;

    const deal = await Deal.findOneAndUpdate({ _id: params.id, owner: user.id }, update, { new: true });
    if (!deal) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (String(existing.stage) !== String(deal.stage)) await emitDeal(user.id, deal, "deal_stage"); // перенос на другой этап запускает правила этого этапа
    return NextResponse.json(deal);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    await connectDB();
    const deal = await Deal.findOneAndDelete({ _id: params.id, owner: user.id });
    if (!deal) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}
