import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { serverError } from "@/lib/api";
import { reportError } from "@/lib/reportError";
import { prisma } from "@/lib/prisma";

// Реквизиты фирмы приходят только со вкладки «Company»: там регистрируют фирму, а не человека,
// поэтому фамилия не спрашивается, а название фирмы становится именем аккаунта
interface CompanyInput { name?: unknown; taxNumber?: unknown; phone?: unknown; address?: unknown }

const text = (v: unknown, max = 120) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { firstname, lastname, email, password } = body as Record<string, unknown>;
        const firm = (body.company ?? null) as CompanyInput | null;
        const companyName = text(firm?.name, 80);
        // причина отказа уходит в code: форма показывает человеку понятный текст на его языке, а не общее «не удалось»
        const bad = (code: string) => NextResponse.json({ message: "Invalid data", code }, { status: 400 });
        if (!text(firstname) || (!text(lastname) && !companyName)) return bad("name_required");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(email, 200))) return bad("email_invalid");
        if (!password || String(password).length < 8) return bad("password_short");
        const normalized = String(email).toLowerCase();
        if (await prisma.user.findUnique({ where: { email: normalized } })) {
            return NextResponse.json({ message: "Email already in use", code: "email_taken" }, { status: 409 });
        }
        const passwordHash = await bcrypt.hash(String(password), 12);
        const created = await prisma.user.create({
            data: {
                firstname: text(firstname, 80),
                lastname: text(lastname, 80),
                email: normalized,
                passwordHash,
                company: companyName,
                phone: text(firm?.phone, 40),
            },
        });
        // Личная фирма нового аккаунта получает id пользователя (lib/auth.ts), поэтому реквизиты
        // из формы можно положить в настройки бухгалтерии сразу: в счетах будут верные данные
        if (companyName) {
            await prisma.financeSettings.create({
                data: {
                    org: created.id,
                    legalName: companyName,
                    taxId: text(firm?.taxNumber, 60),
                    address: text(firm?.address, 200),
                    phone: text(firm?.phone, 40),
                    email: normalized,
                },
            }).catch((e) => reportError("signup:finance-settings", e)); // регистрация из-за этого падать не должна
        }
        // приглашён в фирму до регистрации — доступ появляется сразу
        const invites = await prisma.invitation.findMany({ where: { email: normalized, expiresAt: { gt: new Date() } } });
        for (const inv of invites) {
            const existing = await prisma.membership.findFirst({ where: { org: inv.org, user: created.id } });
            if (!existing) await prisma.membership.create({ data: { org: inv.org, user: created.id, role: inv.role, modules: inv.modules } });
        }
        if (invites.length) await prisma.invitation.deleteMany({ where: { email: normalized } });
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
        return serverError(e);
    }
}
