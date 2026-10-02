import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { ProviderError } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import { cancelShipment, createShipment, trackLast } from "@/lib/ukrposhta";
import { toOrderDTO } from "@/lib/finance/dto";
import { requireMarket } from "@/lib/finance/marketGuard";
import { prisma } from "@/lib/prisma";

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
    const doc = await prisma.integration.findFirst({ where: { owner: org, type: "ukrposhta", status: "connected" } });
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
            await requireMarket(user.id, "UA");
            const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
            if (!order) return notFound();
            if ((order.ukrposhta as any)?.barcode) return badRequest("У замовлення вже є відправлення Укрпошти");
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
                description: String(body.description ?? "").trim() || ((order.items as any[])?.[0]?.description ?? "") || "Товар",
            });
            const saved = await prisma.order.update({
                where: { id: order.id },
                data: {
                    ukrposhta: {
                        ...((order.ukrposhta as any) ?? {}),
                        uuid: created.uuid,
                        barcode: created.barcode,
                        status: "Відправлення створено",
                        statusAt: new Date().toISOString(),
                        postOffice: String(body.postOfficeName ?? ""),
                        cod: Number(body.cod) || 0,
                    } as any,
                },
            });
            return NextResponse.json({ order: toOrderDTO(saved) }, { status: 201 });
        } catch (e) {
            return failure(e);
        }
    }

    const barcodeInput = typeof body.barcode === "string" ? body.barcode.trim().toUpperCase() : undefined;
    if (barcodeInput !== undefined && barcodeInput !== "" && !/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(barcodeInput)) {
        return badRequest("Штрихкод Укрпошти виглядає як RB123456789UA — перевірте номер");
    }
    try {
        await requireMarket(user.id, "UA");
        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        const ukr = { ...((order.ukrposhta as any) ?? {}) } as any;
        if (barcodeInput !== undefined) ukr.barcode = barcodeInput;
        const barcode = String(ukr.barcode ?? "");
        if (!barcode) return badRequest("Спершу вкажіть штрихкод відправлення");

        const [status] = await trackLast(await token(user.id), [barcode]);
        if (status && status.status) {
            ukr.status = status.status;
            ukr.place = status.place;
            ukr.statusAt = new Date().toISOString();
        } else {
            // Пустой ответ — отправление ещё не зарегистрировано в отделении: это не сбой связи
            ukr.status = "Відправлення ще не зареєстровано у відділенні";
            ukr.statusAt = new Date().toISOString();
        }
        const saved = await prisma.order.update({ where: { id: order.id }, data: { ukrposhta: ukr } });
        return NextResponse.json({ order: toOrderDTO(saved) });
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
        await requireMarket(user.id, "UA");
        const order = await prisma.order.findFirst({ where: { id: params.id, org: user.id } });
        if (!order) return notFound();
        const uuid = String((order.ukrposhta as any)?.uuid ?? "");
        if (!uuid) return badRequest("Відправлення створювали в кабінеті Укрпошти — скасуйте його там");
        await cancelShipment(await token(user.id), uuid);
        const saved = await prisma.order.update({ where: { id: order.id }, data: { ukrposhta: { uuid: "", barcode: "", status: "", place: "", statusAt: "", postOffice: "", cod: 0 } as any } });
        return NextResponse.json({ order: toOrderDTO(saved) });
    } catch (e) {
        return failure(e);
    }
}
