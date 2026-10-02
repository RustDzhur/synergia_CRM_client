import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();
        if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
        const user = await prisma.user.findUnique({ where: { email: String(email ?? "").toLowerCase() } });
        const ok = user && (await bcrypt.compare(String(password ?? ""), user.passwordHash));
        if (!ok) {
            return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
        }
        // Сессия живёт сутки: раз в день нужно войти заново. Продления нет —
        // по истечении любой запрос вернёт 401, и клиент уводит на страницу входа.
        const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });
        return NextResponse.json({ token });
    } catch (e) {
        return serverError(e);
    }
}
