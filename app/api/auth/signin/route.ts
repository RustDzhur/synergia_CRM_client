import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimited } from "@/lib/rateLimit";
import { checkEmail } from "@/lib/authRules";
import { verificationEnabled } from "@/lib/emailVerification";

const fail = (field: string, code: string, status: number) => NextResponse.json({ message: "Invalid credentials", field, code }, { status });

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { email, password } = body as { email?: unknown; password?: unknown };
        if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
        // понятная причина, если поле пустое или адрес записан неверно — до обращения к базе
        const emailRule = checkEmail(email);
        if (emailRule && emailRule.code !== "email_typo") return fail("email", emailRule.code === "required" ? "email_required" : "email_format", 400);
        if (!String(password ?? "")) return fail("password", "password_required", 400);
        const normalized = String(email).trim().toLowerCase();
        // перебор паролей: не больше 10 попыток в 15 минут на пару «адрес + IP» (поверх блокировки по IP на уровне сервера)
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (rateLimited(`signin:${normalized}:${ip}`, 10, 15 * 60 * 1000)) return fail("form", "too_many", 429);
        const user = await prisma.user.findUnique({ where: { email: normalized } });
        const ok = user && (await bcrypt.compare(String(password), user.passwordHash));
        if (!ok) return fail("form", "invalid_credentials", 401);
        // почта не подтверждена кодом: войти нельзя, форма предложит ввести код
        if (!user.emailVerified && (await verificationEnabled())) return NextResponse.json({ message: "Email not verified", code: "email_unverified", email: normalized }, { status: 403 });
        // Сессия живёт сутки: раз в день нужно войти заново. Продления нет —
        // по истечении любой запрос вернёт 401, и клиент уводит на страницу входа.
        const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        return NextResponse.json({ token });
    } catch (e) {
        return serverError(e);
    }
}
