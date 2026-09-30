import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { orderPrice } from "@/lib/finance/delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/novaposhta/price — { cityRef, weight, cost, cod?, address? }: стоимость доставки заранее.
// Окно ТТН показывает её до создания: иначе фирма узнаёт цену уже после отправки посылки.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const cityRef = String(b?.cityRef ?? "").trim();
    if (!cityRef) return badRequest("Вкажіть місто отримувача");
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        const price = await orderPrice(user.id, {
            cityRef,
            weight: Number(b?.weight) || 1,
            cost: Number(b?.cost) || 1,
            cod: Number(b?.cod) || 0,
            address: !!b?.address,
        });
        return NextResponse.json(price);
    } catch (e) {
        return failure(e);
    }
}
