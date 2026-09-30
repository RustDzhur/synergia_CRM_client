import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { createOrderWaybill, trackStatuses } from "@/lib/finance/delivery";
import { toOrderDTO } from "@/lib/finance/dto";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ТТН «Нової Пошти» по заказу.
//
// GET  — обновить статус уже созданной ТТН (Нова Пошта отвечает человеческим статусом: «Відправлення
//        прямує до міста отримувача» и т.п.). Номер называют клиенту, поэтому он и хранится в заказе.
// POST — создать ТТН: данные отправителя берутся из настроек доставки, получатель приходит из окна.
//        Отдельного «повторного создания» нет: если ТТН уже есть, отвечаем ею же — иначе на каждый
//        клик появлялась бы новая посылка.

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        const number = String(order.waybill?.number ?? "");
        if (!number) return NextResponse.json({ order: toOrderDTO(order) });
        const [status] = await trackStatuses(user.id, [number]);
        if (status) {
            order.waybill.status = status.status;
            order.waybill.statusAt = new Date();
            await order.save();
        }
        return NextResponse.json({ order: toOrderDTO(order), tracking: status ?? null });
    } catch (e) {
        return failure(e);
    }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
        await connectDB();
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        if (order.waybill?.number) return NextResponse.json({ order: toOrderDTO(order) }, { status: 200 });

        const cityRef = String(b.cityRef ?? "").trim();
        const warehouseRef = String(b.warehouseRef ?? "").trim();
        const recipient = String(b.recipient ?? "").trim();
        const phone = String(b.phone ?? "").trim();
        if (!cityRef || !warehouseRef) return badRequest("Виберіть місто та відділення отримувача");
        if (!recipient) return badRequest("Вкажіть ім'я отримувача");
        if (!/^\+?\d{9,15}$/.test(phone.replace(/[\s()-]/g, ""))) return badRequest("Вкажіть телефон отримувача");

        const weight = Number(b.weight) || 0;
        const cost = Number(b.cost) || 0;
        const cod = Number(b.cod) || 0;
        const created = await createOrderWaybill(user.id, {
            cityRef,
            cityName: String(b.cityName ?? ""),
            warehouseRef,
            warehouseName: String(b.warehouseName ?? ""),
            recipient,
            phone,
            weight: weight || 1,
            cost: cost || 1,
            cod,
            description: String(b.description ?? "").trim() || order.items?.[0]?.description || "Товар",
        });
        order.waybill = {
            number: created.number,
            ref: created.ref,
            status: "Створено",
            statusAt: new Date(),
            cost: created.cost,
            city: String(b.cityName ?? ""),
            cityRef,
            warehouse: String(b.warehouseName ?? ""),
            warehouseRef,
            recipient,
            phone,
            weight: weight || 1,
            cod,
        };
        order.markModified("waybill");
        await order.save();
        return NextResponse.json({ order: toOrderDTO(order) }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
