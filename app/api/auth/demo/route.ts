import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { MAX_DEMOS, createDemo, demoCount } from "@/lib/demo";
import { rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/auth/demo — { locale } → { token }: демо-кабинет без регистрации (своя заполненная копия фирмы, см. lib/demo).
// Защита: не больше 5 демо в час с одного адреса и не больше MAX_DEMOS копий одновременно.
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const locale = body?.locale === "ua" || body?.locale === "en" ? body.locale : "de";
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (rateLimited(`demo:${ip}`, 5, 60 * 60 * 1000)) return NextResponse.json({ message: "Too many demo requests", code: "too_many" }, { status: 429 });
        if ((await demoCount()) >= MAX_DEMOS) return NextResponse.json({ message: "The demo is busy right now", code: "busy" }, { status: 503 });
        const { token } = await createDemo(locale);
        return NextResponse.json({ token });
    } catch (e) {
        return serverError(e);
    }
}
