import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { ProviderError } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import { cancelShipment, createShipment, trackLast } from "@/lib/ukrposhta";
import { toOrderDTO } from "@/lib/finance/dto";
import Integration from "@/models/Integration";
import Order from "@/models/Order";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Укрпошта: отправление (ШКІ) и его статус.
//
// POST с { action: "shipment" } — создать отправление через ecom (нужен договор: адрес отправки
// контрагента и отделение получателя приходят из справочников Укрпошты); штрихкод назначает она сама.
// POST без action ({ barcode? }) — прежний путь: вписать штрихкод, полученный в отделении, и обновить
// статус. Пока отправление не зарегистрировано, Укрпошта честно отвечает «не найдено» — это не сбой.
// DELETE — отменить отправление, пока его не приняли.

async function token(org: string): Promise<string> {
    const doc = await Integration.findOne({ owner: org, type: "ukrposhta", status: "connected" });
    if (!doc) throw new ProviderError("Укрпошту не підключено — додайте bearer-токен у Налаштуваннях → Інтеграції");
    const value = String(secretsOf<{ token?: string }>(doc).token ?? "");
    if (!value) throw new ProviderError("У кабінеті Укрпошти не збережено токен");
    return value;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Создание отправления через ecom: фирма выбрала адрес отправки и отделение получателя
    if (body.action === "shipment") {
        const senderUuid = String(body.senderUuid ?? "").trim();
        const postOfficeId = String(body.postOfficeId ?? "").trim();
        if (!senderUuid) return badRequest("Виберіть адресу відправлення");
        if (!postOfficeId) return badRequest("Виберіть відділення отримувача");
        try {
            await connectDB();
            await requireMarket(user.id, "UA");
            const order = await Order.findOne({ _id: params.id, org: user.id });
            if (!order) return notFound();
            if (order.ukrposhta?.barcode) return badRequest("У замовлення вже є відправлення Укрпошти");
            const recipientName = String(body.recipientName ?? order.customerName ?? "").trim();
            const recipientPhone = String(body.phone ?? "").trim();
            if (!recipientName || !recipientPhone) return badRequest("Вкажіть ім'я та телефон отримувача");
            const created = await createShipment(await token(user.id), {
                senderUuid,
                recipientName,
                recipientPhone,
                postOfficeId,
                weightKg: Number(body.weight) || 1,
                declaredValue: Number(body.declared) || Number(body.cost) || 1,
                codAmount: Number(body.cod) || 0,
                description: String(body.description ?? "").trim() || order.items?.[0]?.description || "Товар",
            });
            order.set("ukrposhta.uuid", created.uuid);
            order.set("ukrposhta.barcode", created.barcode);
            order.set("ukrposhta.status", "Відправлення створено");
            order.set("ukrposhta.statusAt", new Date());
            order.set("ukrposhta.postOffice", String(body.postOfficeName ?? ""));
            order.set("ukrposhta.cod", Number(body.cod) || 0);
            await order.save();
            return NextResponse.json({ order: toOrderDTO(order) }, { status: 201 });
        } catch (e) {
            return failure(e);
        }
    }

    const barcodeInput = typeof body.barcode === "string" ? body.barcode.trim().toUpperCase() : undefined;
    if (barcodeInput !== undefined && barcodeInput !== "" && !/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(barcodeInput)) {
        return badRequest("Штрихкод Укрпошти виглядає як RB123456789UA — перевірте номер");
    }
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        if (barcodeInput !== undefined) order.set("ukrposhta.barcode", barcodeInput);
        const barcode = String(order.ukrposhta?.barcode ?? "");
        if (!barcode) return badRequest("Спершу вкажіть штрихкод відправлення");

        const [status] = await trackLast(await token(user.id), [barcode]);
        if (status && status.status) {
            order.set("ukrposhta.status", status.status);
            order.set("ukrposhta.place", status.place);
            order.set("ukrposhta.statusAt", new Date());
        } else {
            // Пустой ответ — отправление ещё не зарегистрировано в отделении: это не сбой связи
            order.set("ukrposhta.status", "Відправлення ще не зареєстровано у відділенні");
            order.set("ukrposhta.statusAt", new Date());
        }
        await order.save();
        return NextResponse.json({ order: toOrderDTO(order) });
    } catch (e) {
        return failure(e);
    }
}

// DELETE — отменить созданное через ecom отправление и убрать номер из заказа
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();
        const uuid = String(order.ukrposhta?.uuid ?? "");
        if (!uuid) return badRequest("Відправлення створювали в кабінеті Укрпошти — скасуйте його там");
        await cancelShipment(await token(user.id), uuid);
        order.set("ukrposhta", { uuid: "", barcode: "", status: "", place: "", statusAt: undefined, postOffice: "", cod: 0 });
        await order.save();
        return NextResponse.json({ order: toOrderDTO(order) });
    } catch (e) {
        return failure(e);
    }
}
