import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { createOrderWaybill, deleteOrderWaybill, trackStatuses } from "@/lib/finance/delivery";
import { toOrderDTO } from "@/lib/finance/dto";
import { requireMarket } from "@/lib/finance/marketGuard";
import { prisma } from "@/lib/prisma";

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
        await requireMarket(user.id, "UA");
        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        const waybill = { ...((order.waybill as any) ?? {}) } as any;
        const number = String(waybill.number ?? "");
        if (!number) return NextResponse.json({ order: toOrderDTO(order) });
        const [status] = await trackStatuses(user.id, [number]);
        let fresh = order;
        if (status) {
            waybill.status = status.status;
            waybill.statusAt = new Date().toISOString();
            fresh = await prisma.order.update({ where: { id: order.id }, data: { waybill: waybill as any } });
        }
        return NextResponse.json({ order: toOrderDTO(fresh), tracking: status ?? null });
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
        await requireMarket(user.id, "UA");
        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        if ((order.waybill as any)?.number) return NextResponse.json({ order: toOrderDTO(order) }, { status: 200 });

        const cityRef = String(b.cityRef ?? "").trim();
        const warehouseRef = String(b.warehouseRef ?? "").trim();
        const recipient = String(b.recipient ?? "").trim();
        const phone = String(b.phone ?? "").trim();
        // Адресная доставка: улица заполнена — курьер везёт на адрес, и отделение не нужно
        const address = { street: String(b.street ?? "").trim(), house: String(b.house ?? "").trim(), flat: String(b.flat ?? "").trim() };
        const byAddress = !!address.street;
        if (!cityRef || (!byAddress && !warehouseRef)) return badRequest("Виберіть місто та відділення отримувача");
        if (byAddress && !address.house) return badRequest("Для адресної доставки вкажіть вулицю та будинок");
        if (!recipient) return badRequest("Вкажіть ім'я отримувача");
        if (!/^\+?\d{9,15}$/.test(phone.replace(/[\s()-]/g, ""))) return badRequest("Вкажіть телефон отримувача");

        const weight = Number(b.weight) || 0;
        const cost = Number(b.cost) || 0;
        const cod = Number(b.cod) || 0;
        const seats = Math.max(1, Math.round(Number(b.seats) || 1));
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
            seats,
            ...(byAddress ? { address } : {}),
            description: String(b.description ?? "").trim() || ((order.items as any[])?.[0]?.description ?? "") || "Товар",
        });
        const waybill = {
            number: created.number,
            ref: created.ref,
            status: "Створено",
            statusAt: new Date().toISOString(),
            cost: created.cost,
            city: String(b.cityName ?? ""),
            cityRef,
            warehouse: byAddress ? "" : String(b.warehouseName ?? ""),
            warehouseRef: byAddress ? "" : warehouseRef,
            recipient,
            phone,
            weight: weight || 1,
            cod,
            seats,
            street: address.street,
            house: address.house,
            flat: address.flat,
        };
        const saved = await prisma.order.update({ where: { id: order.id }, data: { waybill: waybill as any } });
        return NextResponse.json({ order: toOrderDTO(saved) }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}

// DELETE /api/orders/:id/waybill — удалить ТТН, пока посылка не принята. Новая Пошта отказывает,
// если курьер её уже забрал — тогда остаётся возврат (waybill/return). Номер перестаёт существовать.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await requireMarket(user.id, "UA");
        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        const ref = String((order.waybill as any)?.ref ?? "");
        if (!ref) return badRequest("У замовлення немає ТТН");
        await deleteOrderWaybill(user.id, ref);
        const blank = { number: "", ref: "", status: "", statusAt: "", cost: 0, city: "", cityRef: "", warehouse: "", warehouseRef: "", recipient: "", phone: "", weight: 0, cod: 0, seats: 1, street: "", house: "", flat: "", returnNumber: "", returnAt: "" };
        const saved = await prisma.order.update({ where: { id: order.id }, data: { waybill: blank as any } });
        return NextResponse.json({ order: toOrderDTO(saved) });
    } catch (e) {
        return failure(e);
    }
}
