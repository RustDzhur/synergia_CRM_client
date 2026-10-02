import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings, mkActivity } from "@/lib/activities";
import { emitDeal } from "@/lib/automation/emit";
import { ownedContact, ownedCompany } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { DEAL_TEXT_FIELDS } from "@/lib/crmFields";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json(); // любое из: stage, order, clientName, contactName, ..., availableToAll
    // только разрешённые поля: иначе через PATCH можно было записать в документ что угодно
    const data: Record<string, any> = pickStrings(body, DEAL_TEXT_FIELDS);
    if (typeof body.clientName === "string") {
        if (!body.clientName.trim()) return NextResponse.json({ message: "clientName is required" }, { status: 400 });
        data.clientName = body.clientName.trim().slice(0, 200);
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) data.order = body.order;
    if (typeof body.availableToAll === "boolean") data.availableToAll = body.availableToAll;
    // какие разделы карточки скрыты: значения ограничены списком, иначе в документ попадёт что угодно
    if (Array.isArray(body.hiddenSections)) data.hiddenSections = body.hiddenSections.filter((s: unknown) => s === "more" || s === "recurring");
    // выигрыш сделки: карточку вытянули за последний этап воронки; false снимает отметку
    if (typeof body.won === "boolean") data.wonAt = body.won ? new Date() : null;

    const existing = await prisma.deal.findUnique({ where: { id: params.id } });
    if (!existing || existing.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });

    // "contact"/"company" присланы явно (даже пустой строкой — значит "отвязать") — undefined значит "не трогать"
    if (body.contact !== undefined) data.contact = await ownedContact(body.contact, user.id);
    if (body.company !== undefined) data.company = await ownedCompany(body.company, user.id);

    let stageChanged = false;
    let stageName = "";
    if (body.stage !== undefined) {
        if (!validId(body.stage)) return NextResponse.json({ message: "Invalid stage" }, { status: 400 });
        const stage = await prisma.stage.findFirst({ where: { id: body.stage, owner: user.id } });
        if (!stage) return NextResponse.json({ message: "Stage not found" }, { status: 404 });
        data.stage = stage.id;
        if (existing.stage !== stage.id) {
            stageChanged = true;
            stageName = stage.name;
            // карточку вернули в обычный этап — сделка снова в работе, отметка о выигрыше снимается
            if (typeof body.won !== "boolean") data.wonAt = null;
        }
    }

    if (stageChanged) {
        const activities = Array.isArray(existing.activities) ? existing.activities : [];
        activities.push(mkActivity("stage", stageName));
        data.activities = activities;
    }

    const deal = await prisma.deal.update({ where: { id: params.id }, data: data as any });
    if (stageChanged && existing.stage !== deal.stage) await emitDeal(user.id, toDTO(deal), "deal_stage"); // перенос на другой этап запускает правила этого этапа
    return NextResponse.json(toDTO(deal));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const r = await prisma.deal.deleteMany({ where: { id: params.id, owner: user.id } });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}
