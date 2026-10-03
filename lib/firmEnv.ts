import { decryptJSON, encryptJSON } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

// Персональные переменные окружения ФИРМЫ (ключи сторонних сервисов и т.п.). Клиент даёт администратору платформы ключ нужного API,
// администратор вносит его в админ-кабинете (Админка → фирма → «Переменные»), и серверный код интеграции читает его через
// getFirmEnv(org, "ИМЯ"). Значения лежат зашифрованно (так же, как токены интеграций), в интерфейсе не показываются — только
// имя и длина; изменить можно перезаписью. В автоматизации доступны как {{env.ИМЯ}} в адресе вебхука.
const KEY = "admin:env";
export const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;
const MAX_VALUE = 4000;
const MAX_VARS = 100;

export interface EnvVarInfo { name: string; length: number; updatedAt: string; updatedBy: string }

export async function listFirmEnv(org: string): Promise<EnvVarInfo[]> {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key: KEY }, orderBy: { rid: "asc" }, take: MAX_VARS + 5 });
    return rows.map((r) => {
        const v = (r.values ?? {}) as { value?: string; updatedAt?: string; updatedBy?: string };
        let length = 0;
        try { length = String(decryptJSON<{ v?: string }>(String(v.value ?? "")).v ?? "").length; } catch { /* повреждённое значение — покажем нулевую длину */ }
        return { name: r.rid, length, updatedAt: String(v.updatedAt ?? ""), updatedBy: String(v.updatedBy ?? "") };
    });
}

export async function setFirmEnv(org: string, name: string, value: string, by: string): Promise<void> {
    if (!ENV_NAME.test(name)) throw new Error("Name must be CAPITAL_LETTERS, digits and underscores, starting with a letter (e.g. SHIPPING_API_KEY)");
    const v = String(value);
    if (!v.trim()) throw new Error("Value must not be empty");
    if (v.length > MAX_VALUE) throw new Error(`Value is too long (max ${MAX_VALUE})`);
    const exists = await prisma.sectionRecord.findFirst({ where: { org, key: KEY, rid: name } });
    if (!exists && (await prisma.sectionRecord.count({ where: { org, key: KEY } })) >= MAX_VARS) throw new Error(`Too many variables (max ${MAX_VARS})`);
    const values = { value: encryptJSON({ v }), updatedAt: new Date().toISOString(), updatedBy: by } as never;
    if (exists) await prisma.sectionRecord.update({ where: { id: exists.id }, data: { values } });
    else await prisma.sectionRecord.create({ data: { org, key: KEY, rid: name, values } });
}

export async function deleteFirmEnv(org: string, name: string): Promise<boolean> {
    return (await prisma.sectionRecord.deleteMany({ where: { org, key: KEY, rid: name } })).count > 0;
}

/** Значение переменной фирмы для серверного кода интеграции; пустая строка, если не задана. */
export async function getFirmEnv(org: string, name: string): Promise<string> {
    const row = await prisma.sectionRecord.findFirst({ where: { org, key: KEY, rid: name } });
    if (!row) return "";
    try { return String(decryptJSON<{ v?: string }>(String((row.values as { value?: string }).value ?? "")).v ?? ""); } catch { return ""; }
}

/** Подставляет {{env.ИМЯ}} в строку (для адреса вебхука): нет такой переменной — пустая строка. */
export async function expandFirmEnv(org: string, text: string): Promise<string> {
    if (!text.includes("{{env.")) return text;
    const names = Array.from(new Set(Array.from(text.matchAll(/\{\{\s*env\.([A-Z][A-Z0-9_]*)\s*\}\}/g)).map((m) => m[1])));
    const values: Record<string, string> = {};
    for (const n of names) values[n] = await getFirmEnv(org, n);
    return text.replace(/\{\{\s*env\.([A-Z][A-Z0-9_]*)\s*\}\}/g, (_, n: string) => encodeURIComponent(values[n] ?? ""));
}
