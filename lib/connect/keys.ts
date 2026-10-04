import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { orgFeatures } from "@/lib/features";
import type { AiCtx } from "@/lib/ai/tools";

// «Подключить агента»: ключи доступа ФИРМЫ для внешних ИИ-агентов и ботов (Claude, ChatGPT, Cursor, n8n, Zapier, DeepSeek Harness,
// собственный скрипт). Клиент сам создаёт ключ в Настройках, выбирает, что агенту можно, и вставляет в своего агента адрес и ключ —
// ни серверов, ни папок, ни установки. Агент видит те же инструменты, что Айрис, но только разрешённые ключу: уровень доступа
// переводится в роль (read → наблюдатель, work → менеджер) и список разделов, а роли и права проверяются ровно так же, как
// у живого сотрудника. Изменения по умолчанию не выполняются сразу, а ждут одобрения владельца (очередь «Запросы агентов»).
// Удаление, чистка и служебные инструменты экрана наружу не отдаются вовсе. Хранится только хеш ключа.
export const LEVELS = ["read", "work"] as const;
export type Level = (typeof LEVELS)[number];
export const KEY_MODULES = ["crm", "tasks", "company", "collab", "mail", "marketing", "inventory", "automation"] as const;

const KEYS = "connect:keys";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface ConnectKey { id: string; name: string; level: Level; modules: string[]; envNames: string[]; approval: boolean; createdAt: string; lastUsedAt: string; calls: number }

const toKey = (rid: string, v: Record<string, unknown>): ConnectKey => ({
    id: rid, name: String(v.name ?? ""), level: (v.level === "work" ? "work" : "read") as Level,
    modules: (Array.isArray(v.modules) ? v.modules : []).map(String), envNames: (Array.isArray(v.envNames) ? v.envNames : []).map(String), approval: v.approval !== false,
    createdAt: String(v.createdAt ?? ""), lastUsedAt: String(v.lastUsedAt ?? ""), calls: Number(v.calls) || 0,
});

export async function listKeys(org: string): Promise<ConnectKey[]> {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key: KEYS }, orderBy: { createdAt: "asc" }, take: 100 });
    return rows.map((r) => toKey(r.rid, (r.values ?? {}) as Record<string, unknown>));
}

/** Имена переменных окружения фирмы, которые агенту можно читать: список через запятую/пробел; "*" — все. */
export function cleanEnvNames(raw: unknown): string[] {
    const list = (Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,;]+/)).map((x) => String(x).trim().toUpperCase()).filter(Boolean);
    if (list.includes("*")) return ["*"];
    return Array.from(new Set(list.filter((n) => /^[A-Z][A-Z0-9_]{1,63}$/.test(n)))).slice(0, 100);
}

export async function createKey(org: string, createdBy: string, input: { name: unknown; level: unknown; modules: unknown; approval: unknown; envNames?: unknown }): Promise<{ id: string; token: string }> {
    const name = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (name.length < 2) throw new Error("Give the agent a name (at least 2 characters)");
    const level = (LEVELS as readonly string[]).includes(String(input.level)) ? (String(input.level) as Level) : "read";
    const modules = Array.from(new Set((Array.isArray(input.modules) ? input.modules : []).map(String).filter((m) => (KEY_MODULES as readonly string[]).includes(m))));
    if (!modules.length) throw new Error("Choose at least one section the agent may use");
    if ((await listKeys(org)).length >= 20) throw new Error("Too many keys (max 20) — revoke unused ones");
    const token = `fsk_${randomBytes(32).toString("hex")}`;
    const id = `k${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
    await prisma.sectionRecord.create({ data: { org, key: KEYS, rid: id, values: { name, level, modules, envNames: cleanEnvNames(input.envNames), approval: input.approval !== false, hash: sha(token), createdAt: new Date().toISOString(), lastUsedAt: "", calls: 0, createdBy } as never } });
    return { id, token };
}

export async function revokeKey(org: string, id: string): Promise<boolean> {
    return (await prisma.sectionRecord.deleteMany({ where: { org, key: KEYS, rid: id } })).count > 0;
}

export interface Connection { org: string; orgName: string; key: ConnectKey; ctx: AiCtx }
export type ConnectAuth = { state: "ok"; conn: Connection } | { state: "denied" | "plan" };

/** Ключ из заголовка Authorization → фирма, права и контекст для инструментов. denied — ключ неверный/отозван, plan — тариф без доступа. */
export async function authenticate(req: Request): Promise<ConnectAuth> {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!/^fsk_[0-9a-f]{64}$/.test(token)) return { state: "denied" };
    const row = (await prisma.sectionRecord.findMany({ where: { key: KEYS, values: { path: ["hash"], equals: sha(token) } as never }, take: 1 }))[0];
    if (!row) return { state: "denied" };
    const org = await prisma.organization.findUnique({ where: { id: row.org } });
    if (!org || org.blocked) return { state: "denied" };
    // доступ внешних агентов входит в тариф с ИИ-ассистентом (их инструменты — те же, что у Айрис)
    if (!orgFeatures(org as never).aiAssistant) return { state: "plan" };
    const v = (row.values ?? {}) as Record<string, unknown>;
    const key = toKey(row.rid, v);
    const now = new Date();
    void prisma.sectionRecord.update({ where: { id: row.id }, data: { values: { ...v, lastUsedAt: now.toISOString(), calls: key.calls + 1 } as never } }).catch(() => undefined);
    const ctx: AiCtx = { org: row.org, userId: String(v.createdBy ?? ""), role: key.level === "work" ? "manager" : "viewer", modules: key.modules, today: now.toISOString().slice(0, 10), now: now.toISOString().slice(0, 16) };
    return { state: "ok", conn: { org: row.org, orgName: org.name, key, ctx } };
}
