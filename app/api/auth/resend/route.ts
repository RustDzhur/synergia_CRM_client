import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimited } from "@/lib/rateLimit";
import { sendVerificationCode, verificationEnabled } from "@/lib/emailVerification";

// POST /api/auth/resend — { email, locale? }: отправить код подтверждения ещё раз (не чаще раза в минуту и 5 раз в час)
export async function POST(req: Request) {
    try {
        const b = await req.json().catch(() => null);
        const email = String(b?.email ?? "").trim().toLowerCase();
        const locale = ["en", "de", "ua"].includes(b?.locale) ? b.locale : "en";
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (rateLimited(`resend:${ip}`, 10, 60 * 60 * 1000)) return NextResponse.json({ message: "Too many", code: "too_many" }, { status: 429 });
        if (!(await verificationEnabled()) || !email) return NextResponse.json({ ok: true });
        const user = await prisma.user.findUnique({ where: { email }, select: { emailVerified: true } });
        // Ответ одинаковый для любого адреса: так нельзя узнать, зарегистрирован ли он
        if (user && !user.emailVerified) {
            const r = await sendVerificationCode(email, locale).catch(() => "ok" as const);
            if (r === "wait") return NextResponse.json({ message: "Wait", code: "wait" }, { status: 429 });
            if (r === "limit") return NextResponse.json({ message: "Too many", code: "too_many" }, { status: 429 });
        }
        return NextResponse.json({ ok: true });
    } catch (e) {
        return serverError(e);
    }
}
