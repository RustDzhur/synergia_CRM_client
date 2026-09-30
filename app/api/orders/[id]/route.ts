import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { cleanItems } from "@/lib/finance/totals";
import { applyTaxPolicy } from "@/lib/finance/tax";
import { financeSettings } from "@/lib/finance/settings";
import { consumeForOrder, releaseForOrder } from "@/lib/finance/stock";
import StockMovement from "@/models/StockMovement";
import { Types } from "mongoose";
import Order from "@/models/Order";
import { toOrderDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";

const STATUSES = ["draft", "confirmed", "fulfilled", "invoiced", "closed", "cancelled"];
// закрытый заказ уже отражён в дашборде и счетах — редактировать его задним числом нельзя, только статус
const LOCKED = ["invoiced", "closed", "cancelled"];
// Снять резерв заказа ровно на то количество, что было зарезервировано (по журналу движений):
// повторный вызов или заказ без резерва ничего не делают — склад не «пополняется» из воздуха.
async function releaseReserve(org: string, orderId: string) {
    const reserved = await StockMovement.aggregate([
        { $match: { org: new Types.ObjectId(org), orderId: new Types.ObjectId(orderId), reason: { $in: ["reserve", "reserve_release"] } } },
        { $group: { _id: "$product", qty: { $sum: "$qty" } } },
    ]);
    // qty отрицательный = сколько ещё «висит» в резерве (reserve -qty, reserve_release +qty)
    const open = reserved.filter((r: { qty: number }) => r.qty < 0);
    for (const row of open) {
        await releaseForOrder(org, orderId, [{ product: String(row._id), qty: Math.abs(row.qty) }]);
    }
}


export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const o = await Order.findOne({ _id: params.id, org: user.id });
    return o ? NextResponse.json(toOrderDTO(o)) : notFound();
}

// PATCH /api/orders/:id — { status?, items?, notes?, responsible? }. Переход в "fulfilled" списывает товарные строки со склада.
// Сделку это не двигает автоматически — так решает правило автоматизации на событие order_status (move_stage), гибче, чем зашивать в код.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const order = await Order.findOne({ _id: params.id, org: user.id });
    if (!order) return notFound();
    if (LOCKED.includes(order.status) && (b.items !== undefined || b.customerName !== undefined)) return badRequest("This order is locked (already invoiced/closed/cancelled) and its items can no longer change");

    // правка строк подчиняется текущей налоговой политике фирмы, как и создание
    if (b.items !== undefined) order.items = applyTaxPolicy(cleanItems(b.items), await financeSettings(user.id)) as any;
    if (typeof b.notes === "string") order.notes = b.notes.trim().slice(0, 2000);
    // пустая строка — «печатать оформление из настроек бухгалтерии», поэтому её тоже принимаем
    if (b.template === "") order.template = "";
    else if (isTemplate(b.template)) order.template = b.template;
    if (typeof b.responsible === "string") order.responsible = b.responsible.trim().slice(0, 120);

    let statusChanged = false;
    if (typeof b.status === "string" && STATUSES.includes(b.status) && b.status !== order.status) {
        if (b.status === "fulfilled" && order.status !== "fulfilled") {
            // Резерв (если заказ его брал) снимается перед списанием: иначе склад ушёл бы в минус дважды
            await releaseReserve(user.id, String(order._id));
            await consumeForOrder(user.id, String(order._id), (order.items as any) ?? []);
        }
        if (b.status === "cancelled" && order.status !== "cancelled") {
            await releaseReserve(user.id, String(order._id));
        }
        order.status = b.status;
        statusChanged = true;
    }
    await order.save();
    if (statusChanged) await emit(user.id, { type: "order_status", data: { id: String(order._id), number: order.number, status: order.status, customerName: order.customerName } });
    return NextResponse.json(toOrderDTO(order));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const r = await Order.deleteOne({ _id: params.id, org: user.id, status: "draft" });
    return r.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
