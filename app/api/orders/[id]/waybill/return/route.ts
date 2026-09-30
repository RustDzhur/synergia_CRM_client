import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { createWaybillReturn, waybillReturnOptions } from "@/lib/finance/delivery";
import { toOrderDTO } from "@/lib/finance/dto";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Возврат/перенаправление посылки по ТТН (Украина):
//   GET  — возможен ли возврат и какие причины доступны (Нова Пошта отвечает по каждой ТТН отдельно);
//   POST — оформить возврат { reasonRef, subtypeRef?, type?: "Return"|"Redelivery", note? } и
//          запомнить номер заявки в заказе. Дальше посылка едет назад по правилам Новой Пошты.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        const number = String(order.waybill?.number ?? "");
        if (!number) return badRequest("У замовлення немає ТТН");
        return NextResponse.json(await waybillReturnOptions(user.id, number));
    } catch (e) {
        return failure(e);
    }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        const number = String(order.waybill?.number ?? "");
        if (!number) return badRequest("У замовлення немає ТТН");
        const reasonRef = String(b?.reasonRef ?? "").trim();
        if (!reasonRef) return badRequest("Вкажіть причину повернення");
        const created = await createWaybillReturn(user.id, {
            number,
            reasonRef,
            subtypeRef: typeof b?.subtypeRef === "string" ? b.subtypeRef : undefined,
            type: b?.type === "Redelivery" ? "Redelivery" : "Return",
            note: typeof b?.note === "string" ? b.note : undefined,
        });
        order.waybill.returnNumber = created.number || created.ref;
        order.waybill.returnAt = new Date();
        order.markModified("waybill");
        await order.save();
        return NextResponse.json({ order: toOrderDTO(order), returnNumber: created.number, ref: created.ref }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
