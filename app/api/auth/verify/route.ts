import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimited } from "@/lib/rateLimit";
import { checkVerificationCode } from "@/lib/emailVerification";

// POST /api/auth/verify — { email, code }: подтверждение почты кодом из письма; при успехе сразу возвращает токен входа
export async function POST(req: Request) {
    try {
        const b = await req.json().catch(() => null);
        const email = String(b?.email ?? "").trim().toLowerCase();
        const code = String(b?.code ?? "").replace(/\s/g, "");
        if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (rateLimited(`verify:${email}:${ip}`, 12, 15 * 60 * 1000)) return NextResponse.json({ message: "Too many attempts", code: "too_many" }, { status: 429 });
        if (!email) return NextResponse.json({ message: "Invalid data", code: "email_required" }, { status: 400 });
        if (!/^\d{6}$/.test(code)) return NextResponse.json({ message: "Invalid data", code: "code_format" }, { status: 400 });
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return NextResponse.json({ message: "Invalid code", code: "code_wrong" }, { status: 400 });
        if (!user.emailVerified) {
            const res = await checkVerificationCode(email, code);
            if (res !== "ok") return NextResponse.json({ message: "Invalid code", code: `code_${res}` }, { status: 400 });
            await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
        } else return NextResponse.json({ message: "Invalid code", code: "code_expired" }, { status: 400 });
        const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        return NextResponse.json({ token });
    } catch (e) {
        return serverError(e);
    }
}
