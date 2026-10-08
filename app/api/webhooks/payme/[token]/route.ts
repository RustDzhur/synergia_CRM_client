import { NextResponse } from "next/server";
import { findByToken } from "@/lib/integrations";
import { handlePayme } from "@/lib/uzpay/payme";
import { withPeriodLock } from "@/lib/finance/periodLock";

export const dynamic = "force-dynamic";

// Merchant API Payme (JSON-RPC 2.0): адрес вида /api/webhooks/payme/<маркер фирмы> фирма вписывает в кассу Payme Business как Endpoint URL.
// Протокол требует HTTP 200 на любой ответ, в том числе ошибочный (код ошибки — в теле). Подлинность — по заголовку Authorization.
async function handlePOST(req: Request, { params }: { params: { token: string } }) {
    const doc = await findByToken("payme", params.token);
    if (!doc) return NextResponse.json({ error: { code: -32504, message: { ru: "Касса не найдена", uz: "Kassa topilmadi", en: "Merchant not found" } }, id: null });
    return NextResponse.json(await handlePayme(doc as never, req.headers.get("authorization"), await req.text()));
}

// Закрытый период отвечает 423 (см. lib/finance/periodLock.ts): Payme повторит запрос позже
export const POST = withPeriodLock(handlePOST);
