import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { cleanItems } from "@/lib/finance/totals";
import { consumeForOrder } from "@/lib/finance/stock";
import Order from "@/models/Order";
import { toOrderDTO } from "@/lib/finance/dto";

const STATUSES = ["draft", "confirmed", "fulfilled", "invoiced", "closed", "cancelled"];
// закрытый заказ уже отражён в дашборде и счетах — редактировать его задним числом нельзя, только статус
const LOCKED = ["invoiced", "closed", "cancelled"];

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

    if (b.items !== undefined) order.items = cleanItems(b.items) as any;
    if (typeof b.notes === "string") order.notes = b.notes.trim().slice(0, 2000);
    if (typeof b.responsible === "string") order.responsible = b.responsible.trim().slice(0, 120);

    let statusChanged = false;
    if (typeof b.status === "string" && STATUSES.includes(b.status) && b.status !== order.status) {
        if (b.status === "fulfilled" && order.status !== "fulfilled") {
            await consumeForOrder(user.id, String(order._id), (order.items as any) ?? []);
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
