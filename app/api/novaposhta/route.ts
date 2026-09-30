import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { ProviderError } from "@/lib/http";
import { checkApiKey } from "@/lib/novaposhta";
import { findDelivery, saveDelivery, senderOf } from "@/lib/finance/delivery";
import { secretsOf } from "@/lib/integrations";

export const dynamic = "force-dynamic";

// GET /api/novaposhta — состояние доставки «Новою Поштою»: подключена ли и какие данные отправителя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        await connectDB();
        const doc = await findDelivery(user.id);
        if (!doc) return NextResponse.json({ connected: false, hasKey: false, sender: senderOf({ config: {} }) });
        return NextResponse.json({ connected: true, hasKey: !!secretsOf<{ apiKey?: string }>(doc).apiKey, sender: senderOf(doc) });
    } catch (e) {
        return failure(e);
    }
}

// POST /api/novaposhta — { apiKey?, senderCity, senderWarehouse, senderName, senderPhone }:
// ключ проверяем запросом к Новой Поште ДО сохранения — иначе неверный ключ лежал бы в базе
// и «работал» до первой отправки (та же ловушка, что была у ботов и почты)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const apiKey = String(b.apiKey ?? "").trim();
    const senderCity = String(b.senderCity ?? "").trim();
    if (!senderCity) return badRequest("Вкажіть місто відправника");
    try {
        await connectDB();
        // Пустой ключ — значит оставляем прежний: проверяем только новый
        if (apiKey) await checkApiKey(apiKey).catch((e) => {
            throw new ProviderError(e instanceof ProviderError ? e.message : "Нова Пошта відхилила ключ");
        });
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
    await connectDB();
    const doc = await findDelivery(user.id);
    if (doc) {
        doc.status = "error";
        doc.error = "";
        await doc.deleteOne();
    }
    return NextResponse.json({ connected: false, hasKey: false });
}
