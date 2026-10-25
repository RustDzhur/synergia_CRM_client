import { isPlatformAdminUser } from "@/lib/admin";
import { getFirmEnv } from "@/lib/firmEnv";
import { prisma } from "@/lib/prisma";

/**
 * Настройки уровня платформы (одни на весь SaaS), которые админ вносит
 * в кабинете: Настройки → Интеграции → «Переменные окружения» у фирмы
 * администратора платформы. Это Google OAuth-клиент и developer-token
 * Google Ads — они принадлежат приложению, а не клиенту; личные кабинеты
 * клиентов подключаются через OAuth в своих настройках (Marketing → Ad
 * Performance), как и раньше.
 *
 * Если в кабинете пусто — работают переменные окружения сервера, поэтому
 * действующие установки не ломаются. Значения кэшируются на минуту:
 * изменённые в кабинете подхватываются без перезапуска.
 */
export type PlatformEnvName =
    | "GOOGLE_CLIENT_ID"
    | "GOOGLE_CLIENT_SECRET"
    | "GOOGLE_ADS_DEVELOPER_TOKEN"
    | "GOOGLE_ADS_LOGIN_CUSTOMER_ID"
    | "GOOGLE_ADS_API_VERSION"
    | "GOOGLE_ADS_API_URL";

const NAMES: readonly PlatformEnvName[] = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_ADS_API_VERSION",
    "GOOGLE_ADS_API_URL",
];

const g = globalThis as { __platformEnv?: { at: number; value: Partial<Record<PlatformEnvName, string>> } };
const TTL_MS = 60_000;

async function load(): Promise<Partial<Record<PlatformEnvName, string>>> {
    // Ищем администратора платформы, у которого заполнена хотя бы одна из переменных.
    const rows = await prisma.sectionRecord.findMany({ where: { key: "admin:env" }, take: 200 });
    for (const row of rows) {
        if (!NAMES.includes(row.rid as PlatformEnvName)) continue;
        const org = await prisma.organization.findUnique({ where: { id: row.org }, select: { ownerUser: true } }).catch(() => null);
        if (!org) continue;
        const owner = await prisma.user.findUnique({ where: { id: org.ownerUser } }).catch(() => null);
        if (!owner || !(await isPlatformAdminUser(owner as never))) continue;
        const out: Partial<Record<PlatformEnvName, string>> = {};
        for (const name of NAMES) {
            const value = await getFirmEnv(row.org, name);
            if (value) out[name] = value.trim();
        }
        return out;
    }
    return {};
}

/** Значение настройки платформы: сначала кабинет администратора, затем окружение сервера. */
export async function platformEnv(name: PlatformEnvName): Promise<string> {
    const now = Date.now();
    if (!g.__platformEnv || now - g.__platformEnv.at >= TTL_MS) {
        try {
            g.__platformEnv = { at: now, value: await load() };
        } catch {
            g.__platformEnv = { at: now, value: g.__platformEnv?.value ?? {} };
        }
    }
    return (g.__platformEnv.value[name] ?? process.env[name] ?? "").trim();
}

/** Загрузить значения в кэш (вызывается в точках входа: OAuth, реклама, диагностика). */
export async function ensurePlatformEnv(): Promise<void> {
    await platformEnv("GOOGLE_CLIENT_ID");
}

/** Синхронное чтение кэша (после ensurePlatformEnv) с фолбэком на окружение сервера. */
export function platformEnvCached(name: PlatformEnvName): string {
    return (g.__platformEnv?.value[name] ?? process.env[name] ?? "").trim();
}

export const resetPlatformEnv = () => { g.__platformEnv = undefined; };
