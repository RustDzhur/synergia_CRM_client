import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { cleanItems } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { financeSettings } from "@/lib/finance/settings";
import { OrderStatusError, setOrderStatus } from "@/lib/finance/orderStatus";
import { toOrderDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { prisma } from "@/lib/prisma";

// закрытый заказ уже отражён в дашборде и счетах — редактировать его задним числом нельзя, только статус
const LOCKED = ["invoiced", "paid", "closed", "cancelled"];

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const o = await prisma.order.findUnique({ where: { id: params.id } });
    return o && o.org === user.id ? NextResponse.json(toOrderDTO(o)) : notFound();
}

// PATCH /api/orders/:id — { status?, items?, notes?, responsible? }. Переход в "fulfilled" списывает товарные строки со склада.
// Сделку это не двигает автоматически — так решает правило автоматизации на событие order_status (move_stage), гибче, чем зашивать в код.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order || order.org !== user.id) return notFound();
    if (LOCKED.includes(order.status) && (b.items !== undefined || b.customerName !== undefined)) return badRequest("This order is locked (already invoiced/closed/cancelled) and its items can no longer change");

    // правка строк подчиняется текущей налоговой политике фирмы, как и создание
    const data: Record<string, any> = {};
    if (b.items !== undefined) data.items = applyTaxPolicy(cleanItems(b.items), await financeSettings(user.id));
    if (typeof b.notes === "string") data.notes = b.notes.trim().slice(0, 2000);
    // пустая строка — «печатать оформление из настроек бухгалтерии», поэтому её тоже принимаем
    if (b.template === "") data.template = "";
    else if (isTemplate(b.template)) data.template = b.template;
    if (typeof b.responsible === "string") data.responsible = b.responsible.trim().slice(0, 120);

    // Статус меняется только по таблице переходов (lib/finance/orderStatus.ts); склад двигается в той же транзакции
    let current = order;
    if (typeof b.status === "string" && b.status !== order.status) {
        try {
            current = (await setOrderStatus(user.id, order.id, b.status, { userId: user.userId })).order;
        } catch (e) {
            if (e instanceof OrderStatusError) return badRequest(e.message);
            throw e;
        }
    }
    const updated = Object.keys(data).length ? await prisma.order.update({ where: { id: params.id }, data }) : current;
    return NextResponse.json(toOrderDTO(updated));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const r = await prisma.order.deleteMany({ where: { id: params.id, org: user.id, status: "draft" } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
