import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { serverError } from "@/lib/api";
import { reportError } from "@/lib/reportError";
import { prisma } from "@/lib/prisma";
import { rateLimited } from "@/lib/rateLimit";
import { checkAddress, checkEmail, checkName, checkPassword, checkPhone, checkTax, type RuleResult } from "@/lib/authRules";
import { sendVerificationCode, verificationEnabled } from "@/lib/emailVerification";
import { isFullLocale } from "@/lib/locales";

// Реквизиты фирмы приходят только со вкладки «Company»: там регистрируют фирму, а не человека,
// поэтому фамилия не спрашивается, а название фирмы становится именем аккаунта
interface CompanyInput { name?: unknown; taxNumber?: unknown; phone?: unknown; address?: unknown }

const text = (v: unknown, max = 120) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");

// Отказ с причиной: code — правило (lib/authRules или email_taken и т.п.), field — какое поле неверно; форма показывает человеку
// понятный текст на его языке, а не общее «не удалось»
const bad = (field: string, rule: RuleResult | string, status = 400) => {
    const r = typeof rule === "string" ? { code: rule, params: undefined } : rule;
    return NextResponse.json({ message: "Invalid data", field, code: r.code, params: r.params }, { status });
};

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (rateLimited(`signup:${ip}`, 8, 60 * 60 * 1000)) return bad("form", "too_many", 429);
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") return bad("form", "generic");
        // «ловушка для ботов»: человек это скрытое поле не видит и не заполняет
        if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true }, { status: 201 });
        const { firstname, lastname, email, password } = body as Record<string, unknown>;
        const firm = (body.company ?? null) as CompanyInput | null;
        const companyName = text(firm?.name, 80);
        const locale = isFullLocale(body.locale) ? body.locale : "en";

        // проверки по порядку полей: первая ошибка возвращается с названием поля
        const nameRule = companyName ? checkName(companyName) : checkName(firstname);
        if (nameRule) return bad(companyName ? "companyName" : "firstname", nameRule);
        if (!companyName) {
            const lastRule = checkName(lastname);
            if (lastRule) return bad("lastname", lastRule);
        }
        const emailRule = checkEmail(email);
        if (emailRule?.code === "required" || emailRule?.code === "email_format") return bad("email", emailRule);
        const passRule = checkPassword(password);
        if (passRule) return bad("password", passRule);
        if (firm) {
            const r = checkPhone(firm.phone) ?? null;
            if (r) return bad("phone", r);
            const t = checkTax(firm.taxNumber);
            if (t) return bad("taxNumber", t);
            const a = checkAddress(firm.address);
            if (a) return bad("address", a);
        }

        const normalized = String(email).trim().toLowerCase();
        const needVerify = await verificationEnabled();
        const existing = await prisma.user.findUnique({ where: { email: normalized } });
        // Адрес занят подтверждённым аккаунтом — отказ. Занят неподтверждённым — это чья-то незавершённая (или чужая) попытка:
        // даём настоящему владельцу почты зарегистрироваться заново, а не навсегда «захваченным» адресом
        if (existing && (existing.emailVerified || !needVerify)) return bad("email", "email_taken", 409);

        const passwordHash = await bcrypt.hash(String(password), 12);
        const data = {
            firstname: text(firstname, 80),
            lastname: text(lastname, 80),
            passwordHash,
            company: companyName,
            phone: text(firm?.phone, 40),
        };
        const created = existing
            ? await prisma.user.update({ where: { id: existing.id }, data })
            : await prisma.user.create({ data: { ...data, email: normalized, emailVerified: needVerify ? null : new Date() } });
        // Личная фирма нового аккаунта получает id пользователя (lib/auth.ts), поэтому реквизиты
        // из формы можно положить в настройки бухгалтерии сразу: в счетах будут верные данные
        if (companyName) {
            await prisma.financeSettings.upsert({
                where: { org: created.id },
                create: { org: created.id, legalName: companyName, taxId: text(firm?.taxNumber, 60), address: text(firm?.address, 200), phone: text(firm?.phone, 40), email: normalized },
                update: { legalName: companyName, taxId: text(firm?.taxNumber, 60), address: text(firm?.address, 200), phone: text(firm?.phone, 40), email: normalized },
            }).catch((e) => reportError("signup:finance-settings", e)); // регистрация из-за этого падать не должна
        }
        // приглашён в фирму до регистрации — доступ появляется сразу (войти можно будет после подтверждения почты)
        const invites = await prisma.invitation.findMany({ where: { email: normalized, expiresAt: { gt: new Date() } } });
        for (const inv of invites) {
            const known = await prisma.membership.findFirst({ where: { org: inv.org, user: created.id } });
            if (!known) await prisma.membership.create({ data: { org: inv.org, user: created.id, role: inv.role, modules: inv.modules } });
        }
        if (invites.length) await prisma.invitation.deleteMany({ where: { email: normalized } });

        if (needVerify) {
            const sent = await sendVerificationCode(normalized, locale).catch((e) => { reportError("signup:send-code", e); return "error" as const; });
            if (sent === "error") return bad("email", "mail_failed", 502);
            return NextResponse.json({ ok: true, verify: true, email: normalized }, { status: 201 });
        }
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
        return serverError(e);
    }
}
