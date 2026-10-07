import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { cleanItems } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { financeSettings } from "@/lib/finance/settings";
import { consumeForOrder, releaseForOrder } from "@/lib/finance/stock";
import { toOrderDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { prisma } from "@/lib/prisma";

const STATUSES = ["draft", "confirmed", "fulfilled", "invoiced", "paid", "closed", "cancelled"];
// закрытый заказ уже отражён в дашборде и счетах — редактировать его задним числом нельзя, только статус
const LOCKED = ["invoiced", "paid", "closed", "cancelled"];
// Снять резерв заказа ровно на то количество, что было зарезервировано (по журналу движений):
// повторный вызов или заказ без резерва ничего не делают — склад не «пополняется» из воздуха.
async function releaseReserve(org: string, orderId: string) {
    const reserved = await prisma.stockMovement.groupBy({
        by: ["product"],
        where: { org, orderId, reason: { in: ["reserve", "reserve_release"] } },
        _sum: { qty: true },
    });
    // qty отрицательный = сколько ещё «висит» в резерве (reserve -qty, reserve_release +qty)
    const open = reserved.filter((r) => (r._sum.qty ?? 0) < 0);
    for (const row of open) {
        await releaseForOrder(org, orderId, [{ product: row.product, qty: Math.abs(row._sum.qty ?? 0) }]);
    }
}

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

    let statusChanged = false;
    if (typeof b.status === "string" && STATUSES.includes(b.status) && b.status !== order.status) {
        if (b.status === "fulfilled" && order.status !== "fulfilled") {
            // Резерв (если заказ его брал) снимается перед списанием: иначе склад ушёл бы в минус дважды
            await releaseReserve(user.id, order.id);
            await consumeForOrder(user.id, order.id, (order.items as any) ?? []);
        }
        if (b.status === "cancelled" && order.status !== "cancelled") {
            await releaseReserve(user.id, order.id);
        }
        data.status = b.status;
        statusChanged = true;
    }
    const updated = await prisma.order.update({ where: { id: params.id }, data });
    if (statusChanged) await emit(user.id, { type: "order_status", data: { id: updated.id, number: updated.number, status: updated.status, customerName: updated.customerName } });
    return NextResponse.json(toOrderDTO(updated));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const r = await prisma.order.deleteMany({ where: { id: params.id, org: user.id, status: "draft" } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
