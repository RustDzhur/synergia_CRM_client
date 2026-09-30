import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { ProviderError } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import { trackLast } from "@/lib/ukrposhta";
import { toOrderDTO } from "@/lib/finance/dto";
import Integration from "@/models/Integration";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Укрпошта: штрихкод отправления (ШКІ) и его статус.
//
// POST — { barcode? }: вписать штрихкод и/или обновить статус. Отправление регистрируют в отделении,
// и номер известен только тогда — поэтому его вписывает менеджер, а статус CRM тянет сама.
// Пока отправление не зарегистрировано, Укрпошта честно отвечает «не найдено» — это не ошибка связи,
// и в интерфейсе так и говорится.

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
    const barcodeInput = typeof body.barcode === "string" ? body.barcode.trim().toUpperCase() : undefined;
    if (barcodeInput !== undefined && barcodeInput !== "" && !/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(barcodeInput)) {
        return badRequest("Штрихкод Укрпошти виглядає як RB123456789UA — перевірте номер");
    }
    try {
        await connectDB();
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
