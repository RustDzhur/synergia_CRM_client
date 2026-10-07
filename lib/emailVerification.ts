import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { mailConfigured, sendSystemMail } from "@/lib/systemMail";

// Подтверждение почты кодом из письма. Включается само, когда настроена отправка почты (lib/systemMail), и отключается EMAIL_VERIFICATION=0:
// без рабочей почты код никуда не уйдёт, и обязательное подтверждение закрыло бы вход всем.
export const verificationEnabled = async () => process.env.EMAIL_VERIFICATION !== "0" && (await mailConfigured());

// Подтверждение действует для аккаунтов, созданных с этой даты: прежние клиенты подтверждены и чисткой не затрагиваются
const VERIFY_SINCE = new Date("2026-10-08T00:00:00Z");
const TTL_MS = 15 * 60 * 1000;
export const RESEND_AFTER_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

const hash = (email: string, code: string) =>
    crypto.createHash("sha256").update(`${email}:${code}:${process.env.JWT_SECRET ?? ""}`).digest("hex");

const TEXTS: Record<string, { subject: (c: string) => string; body: (c: string) => string }> = {
    en: { subject: (c) => `Firmspace: your confirmation code ${c}`, body: (c) => `Your Firmspace confirmation code: ${c}\n\nIt is valid for 15 minutes. If you did not register, just ignore this email.` },
    de: { subject: (c) => `Firmspace: Ihr Bestätigungscode ${c}`, body: (c) => `Ihr Firmspace-Bestätigungscode: ${c}\n\nEr ist 15 Minuten gültig. Wenn Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.` },
    ua: { subject: (c) => `Firmspace: ваш код підтвердження ${c}`, body: (c) => `Ваш код підтвердження Firmspace: ${c}\n\nВін дійсний 15 хвилин. Якщо ви не реєструвались, просто проігноруйте цей лист.` },
};

// Генерирует и отправляет новый код. Возвращает "ok", "wait" (код отправляли меньше минуты назад) или "limit" (больше 5 писем за час)
export async function sendVerificationCode(email: string, locale: string): Promise<"ok" | "wait" | "limit"> {
    const prev = await prisma.emailCode.findUnique({ where: { email } });
    const now = Date.now();
    if (prev && now - prev.sentAt.getTime() < RESEND_AFTER_MS) return "wait";
    const sendsInHour = prev && now - prev.createdAt.getTime() < 3600_000 ? prev.sends : 0;
    if (sendsInHour >= MAX_SENDS_PER_HOUR) return "limit";
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const data = { codeHash: hash(email, code), expiresAt: new Date(now + TTL_MS), attempts: 0, sentAt: new Date(now) };
    await prisma.emailCode.upsert({
        where: { email },
        create: { email, ...data },
        update: { ...data, sends: sendsInHour + 1, ...(sendsInHour === 0 ? { createdAt: new Date(now) } : {}) },
    });
    const tx = TEXTS[locale] ?? TEXTS.en;
    await sendSystemMail(email, tx.subject(code), tx.body(code));
    return "ok";
}

// Проверка введённого кода: "ok" | "wrong" | "expired" | "attempts" (5 неверных вводов — нужен новый код)
export async function checkVerificationCode(email: string, code: string): Promise<"ok" | "wrong" | "expired" | "attempts"> {
    const row = await prisma.emailCode.findUnique({ where: { email } });
    if (!row || row.expiresAt.getTime() < Date.now()) return "expired";
    if (row.attempts >= MAX_ATTEMPTS) return "attempts";
    const given = Buffer.from(hash(email, code.trim()));
    const real = Buffer.from(row.codeHash);
    if (given.length === real.length && crypto.timingSafeEqual(given, real)) {
        await prisma.emailCode.delete({ where: { email } }).catch(() => {});
        return "ok";
    }
    await prisma.emailCode.update({ where: { email }, data: { attempts: { increment: 1 } } });
    return "wrong";
}

// Чистка: коды старше суток и аккаунты, которые так и не подтвердили почту за 3 дня (войти в них было нельзя, данных в них нет)
export async function purgeUnverified(): Promise<number> {
    await prisma.emailCode.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
    const stale = await prisma.user.findMany({ where: { emailVerified: null, createdAt: { gte: VERIFY_SINCE, lt: new Date(Date.now() - 3 * 24 * 3600_000) } }, select: { id: true } });
    if (!stale.length) return 0;
    const ids = stale.map((u) => u.id);
    await prisma.membership.deleteMany({ where: { user: { in: ids } } });
    await prisma.financeSettings.deleteMany({ where: { org: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    return ids.length;
}
