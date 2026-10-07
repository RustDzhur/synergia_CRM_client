import { NextResponse } from "next/server";
import { promoInfo } from "@/lib/promo";

export const dynamic = "force-dynamic";

// GET /api/promo — публично: сколько мест программы «первые 500 — год бесплатно» осталось и на какой адрес писать
export async function GET() {
    try {
        return NextResponse.json(await promoInfo(), { headers: { "Cache-Control": "public, max-age=60" } });
    } catch {
        return NextResponse.json({ seats: 500, taken: 0, left: 500, months: 12, email: "" });
    }
}
