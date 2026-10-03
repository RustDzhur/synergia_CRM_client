import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/api";
import { getRequisites, saveRequisites } from "@/lib/transferPay";

export const dynamic = "force-dynamic";

// Реквизиты платформы для приёма оплаты тарифов переводом (только администратор платформы).
// GET — текущие, PUT — сохранить: IBAN проверяется по контрольной сумме, адрес USDT — по формату Tron.
export async function GET(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json(await getRequisites());
}

export async function PUT(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = await req.json().catch(() => null);
    if (!b) return badRequest("Invalid request");
    try {
        return NextResponse.json(await saveRequisites(b));
    } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Invalid requisites");
    }
}
