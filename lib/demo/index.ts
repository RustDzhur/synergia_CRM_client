import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_DOMAIN, DEMO_TTL_MS, isDemoEmail } from "./rules";
import { seedDemoOrg } from "./seed";

// Демо-кабинет: посетитель без регистрации получает СВОЮ заполненную копию фирмы (клиенты, сделки, склад, счета, роботы…).
// Он может делать в ней что угодно — двигать, удалять, создавать, — а когда выходит (или через DEMO_TTL), копия стирается целиком.
// Следующий посетитель получает такую же исходную. Общего образца, который можно испортить, нет.
//  • Демо-пользователь — обычная учётная запись с адресом на домене .invalid (войти по паролю невозможно: пароль случайный и нигде не хранится).
//  • Его фирма — тариф «professional» на время демо, ИИ — не больше DEMO_AI_LIMIT запросов, опасные и «внешние» действия закрыты (demoBlocked).

export { DEMO_DOMAIN, DEMO_TTL_MS, MAX_DEMOS, demoAiLimit, demoBlocked, isDemoEmail } from "./rules";

const rid = () => `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;

export async function demoCount(): Promise<number> {
    return prisma.user.count({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });
}

/** Создаёт демо-пользователя с заполненной фирмой и возвращает токен входа. */
export async function createDemo(locale: "ua" | "en" | "de"): Promise<{ token: string; userId: string }> {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
    const firstname = locale === "ua" ? "Гість" : locale === "de" ? "Gast" : "Guest";
    const user = await prisma.user.create({
        data: {
            firstname, lastname: "Demo", email: `demo-${rid()}@${DEMO_DOMAIN}`, passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 4), emailVerified: new Date(),
            company: "Demo Technik GmbH", timezone: "Europe/Berlin", country: "DE",
        },
    });
    try {
        const until = new Date(Date.now() + DEMO_TTL_MS + 30 * 60 * 1000);
        await prisma.organization.create({ data: { id: user.id, name: "Demo Technik GmbH", ownerUser: user.id, plan: "free", planOverride: "professional", planOverrideUntil: until, activities: [] } });
        await prisma.membership.create({ data: { org: user.id, user: user.id, role: "owner" } });
        await seedDemoOrg(user.id, `${firstname} Demo`, locale);
    } catch (e) {
        await destroyDemo(user.id).catch(() => undefined); // недосозданная копия не должна остаться в базе
        throw e;
    }
    const token = jwt.sign({ sub: user.id, demo: true }, process.env.JWT_SECRET, { expiresIn: Math.floor(DEMO_TTL_MS / 1000) });
    return { token, userId: user.id };
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Стирает демо-пользователя и ВСЕ записи его фирмы во всех таблицах (по полям org/owner). Для настоящих пользователей не работает: проверяется адрес. */
export async function destroyDemo(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user || !isDemoEmail(user.email) || !user.id) return false;
    const db = prisma as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> } | undefined>;
    for (const model of Prisma.dmmf.datamodel.models) {
        const names = new Set(model.fields.map((f) => f.name));
        const key = ["org", "owner"].find((k) => names.has(k));
        if (!key || model.name === "Organization" || model.name === "User") continue;
        try { await db[lower(model.name)]?.deleteMany({ where: { [key]: user.id } }); } catch { /* таблица без такого поля или уже пуста — идём дальше */ }
    }
    await prisma.membership.deleteMany({ where: { user: user.id } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: user.id } }).catch(() => undefined);
    await prisma.emailCode.deleteMany({ where: { email: user.email } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: user.id } });
    return true;
}

/** Убирает демо-копии старше срока (посетитель закрыл вкладку, не выходя). Возвращает, сколько удалено. */
export async function sweepDemos(maxAgeMs = DEMO_TTL_MS + 60 * 60 * 1000): Promise<number> {
    const old = await prisma.user.findMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` }, createdAt: { lt: new Date(Date.now() - maxAgeMs) } }, select: { id: true }, take: 50 });
    let n = 0;
    for (const u of old) if (await destroyDemo(u.id).catch(() => false)) n++;
    return n;
}

/** Раз в 10 минут — только в серверном процессе (instrumentation.node.ts). */
export function startDemoSweeper() {
    const g = globalThis as { __demoSweeper?: boolean };
    if (g.__demoSweeper) return;
    g.__demoSweeper = true;
    const timer = setInterval(() => { void sweepDemos().catch((e) => console.error("demo sweep:", e instanceof Error ? e.message : e)); }, 10 * 60_000);
    timer.unref?.();
}
