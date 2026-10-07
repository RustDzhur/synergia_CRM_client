import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings, mkActivity } from "@/lib/activities";
import { emit, emitDeal } from "@/lib/automation/emit";
import { ownedContact, ownedCompany } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { dealScope, resolveResponsible } from "@/lib/sync/people";
import { logActivity } from "@/lib/sync/feed";
import { unlinkDeal } from "@/lib/sync/customer";
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

    const existing = await prisma.deal.findFirst({ where: { id: params.id, owner: user.id, ...dealScope(user) } });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
    // «ответственный» вводится словами; сопоставляем его с участником фирмы (уведомления и видимость закрытых сделок)
    if (typeof body.responsible === "string") data.responsibleUser = await resolveResponsible(user.id, body.responsible);

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
    // этап и выигрыш видны и в ленте клиента: карточка контакта показывает, что происходит с его сделками
    if (stageChanged) await logActivity(user.id, { contact: deal.contact, company: deal.company }, { type: "stage", text: `${deal.clientName}: ${stageName}`, meta: `deal:${deal.id}` });
    if (deal.wonAt && !existing.wonAt) {
        await logActivity(user.id, { deal: deal.id, contact: deal.contact, company: deal.company }, { type: "won", text: `Сделка выиграна: ${deal.clientName}`, meta: `deal:${deal.id}`, key: `won:${deal.id}:${deal.wonAt.getTime()}` });
        await emit(user.id, { type: "deal_won", data: { id: deal.id, name: deal.clientName, contactName: deal.contactName, stageId: String(deal.stage), responsible: deal.responsible } });
    }
    if (stageChanged && existing.stage !== deal.stage) await emitDeal(user.id, toDTO(deal), "deal_stage"); // перенос на другой этап запускает правила этого этапа
    return NextResponse.json(toDTO(deal));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const found = await prisma.deal.findFirst({ where: { id: params.id, owner: user.id, ...dealScope(user) }, select: { id: true, clientName: true, contact: true, company: true } });
    if (!found) return NextResponse.json({ message: "Not found" }, { status: 404 });
    // задачи, документы и расходы остаются у клиента, но не ссылаются на удалённую сделку
    await unlinkDeal(user.id, found.id);
    await prisma.deal.deleteMany({ where: { id: found.id, owner: user.id } });
    await logActivity(user.id, { contact: found.contact, company: found.company }, { type: "note", text: `Сделка удалена: ${found.clientName}`, meta: "deal-deleted" });

    return NextResponse.json({ ok: true });
}
