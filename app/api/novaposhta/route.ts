import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { findDelivery, saveDelivery, senderOf } from "@/lib/finance/delivery";
import { secretsOf } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";

// GET /api/novaposhta — состояние доставки «Новою Поштою»: подключена ли и какие данные отправителя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        await requireMarket(user.id, "UA");
        const doc = await findDelivery(user.id);
        if (!doc) return NextResponse.json({ connected: false, hasKey: false, sender: senderOf({ config: {} }) });
        return NextResponse.json({ connected: true, hasKey: !!secretsOf<{ apiKey?: string }>(doc).apiKey, sender: senderOf(doc) });
    } catch (e) {
        return failure(e);
    }
}

// POST /api/novaposhta — { apiKey?, senderCity, senderWarehouse, senderName, senderPhone }:
// ключ проверяем запросом к Новой Поште ДО сохранения — иначе неверный ключ лежал бы в базе
// и «работал» до первой отправки.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const apiKey = String(b.apiKey ?? "").trim();
    const senderCity = String(b.senderCity ?? "").trim();
    if (!senderCity) return badRequest("Вкажіть місто відправника");
    try {
        await requireMarket(user.id, "UA");
        // Ключ проверяет saveDelivery до записи (и новый, и прежний при правке отправителя)
        const doc = await saveDelivery(user.id, {
            apiKey,
            senderCity,
            senderWarehouse: String(b.senderWarehouse ?? ""),
            senderName: String(b.senderName ?? ""),
            senderPhone: String(b.senderPhone ?? ""),
            senderCityRef: typeof b.senderCityRef === "string" ? b.senderCityRef : undefined,
        });
        return NextResponse.json({ connected: true, hasKey: true, sender: senderOf(doc) });
    } catch (e) {
        return failure(e);
    }
}

// DELETE /api/novaposhta — отключить доставку (ключ удаляется вместе с интеграцией)
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    // отказ по режиму рынка — 409 с кодом market, а не 500 от исключения
    try { await requireMarket(user.id, "UA"); } catch (e) { return failure(e); }
    const doc = await findDelivery(user.id);
    if (doc) await prisma.integration.deleteMany({ where: { id: doc.id } });
    return NextResponse.json({ connected: false, hasKey: false });
}
