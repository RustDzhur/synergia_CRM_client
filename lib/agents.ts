import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

// Реестр внешних агентов (DeepSeek Harness и др.), которые работают с платформой. У каждого агента свой токен и свой набор прав
// (scopes): создаётся и отзывается в CRM (Настройки → Интеграции → «Агенты»), сервер хранит только хеш токена — сам токен
// показывается один раз при создании. Права выдаются точечно: «blog» (читать статьи и класть черновики). Секреты фирмы агентам отдаёт не этот реестр, а ключ «Подключить агента или бота» (Настройки → Интеграции).
// Новое право добавляется вместе с конкретным маршрутом, а не как «доступ ко всему».
export const AGENT_SCOPES = ["blog"] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

const ORG = "platform"; // реестр общий для платформы, не принадлежит ни одной фирме
const KEY = "agents:registry";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface AgentRow { id: string; name: string; scopes: AgentScope[]; createdAt: string; lastUsedAt: string; createdBy: string }

export async function listAgents(): Promise<AgentRow[]> {
    const rows = await prisma.sectionRecord.findMany({ where: { org: ORG, key: KEY }, orderBy: { createdAt: "asc" }, take: 200 });
    return rows.map((r) => { const v = (r.values ?? {}) as Record<string, unknown>; return { id: r.rid, name: String(v.name ?? ""), scopes: (Array.isArray(v.scopes) ? v.scopes : []) as AgentScope[], createdAt: String(v.createdAt ?? ""), lastUsedAt: String(v.lastUsedAt ?? ""), createdBy: String(v.createdBy ?? "") }; });
}

/** Создаёт агента и возвращает токен — единственный раз. */

// Выдача токена агенту без ручного копирования: сайт сам кладёт файл <имя>.env в общую папку учётных данных. Папка ~/agents/_creds на сервере
// подключена к контейнеру сайта как /agent-creds (deploy/docker-compose.yml), а у Harness она видна как /workspace/_creds. Туда пишется только
// этот файл (0600), больше сайт в папки агентов не лезет.
const CREDS_DIR = () => process.env.AGENT_CREDS_PATH || "/agent-creds";
export const agentSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "agent";

export interface Delivery { delivered: boolean; file: string }
export async function deliverToken(name: string, token: string): Promise<Delivery> {
    const slug = agentSlug(name);
    const file = `/workspace/_creds/${slug}.env`; // путь глазами агента внутри Harness
    try {
        await mkdir(CREDS_DIR(), { recursive: true });
        const base = (process.env.APP_URL_INTERNAL || "http://127.0.0.1:3210").replace(/\/+$/, "");
        await writeFile(path.join(CREDS_DIR(), `${slug}.env`), `FIRMSPACE_API=${base}\nFIRMSPACE_TOKEN=${token}\n`, { mode: 0o600 });
        return { delivered: true, file };
    } catch {
        return { delivered: false, file };
    }
}

/** Новый токен для существующего агента (старый перестаёт работать) — сразу кладётся в файл агента. Нужен, когда токен потерян. */
export async function rotateAgent(id: string): Promise<{ token: string } & Delivery | null> {
    const row = await prisma.sectionRecord.findFirst({ where: { org: ORG, key: KEY, rid: id } });
    if (!row) return null;
    const v = row.values as { name?: string };
    const token = `fsa_${randomBytes(32).toString("hex")}`;
    await prisma.sectionRecord.update({ where: { id: row.id }, data: { values: { ...(row.values as object), hash: sha(token) } as never } });
    return { token, ...(await deliverToken(String(v.name ?? "agent"), token)) };
}

export async function createAgent(name: string, scopes: string[], createdBy: string): Promise<{ id: string; token: string } & Delivery> {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (clean.length < 2) throw new Error("Give the agent a name (at least 2 characters)");
    const sc = Array.from(new Set(scopes.filter((s): s is AgentScope => (AGENT_SCOPES as readonly string[]).includes(s))));
    if (!sc.length) throw new Error("Choose at least one permission");
    if ((await listAgents()).length >= 50) throw new Error("Too many agents (max 50)");
    const token = `fsa_${randomBytes(32).toString("hex")}`;
    const id = `a${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
    await prisma.sectionRecord.create({ data: { org: ORG, key: KEY, rid: id, values: { name: clean, scopes: sc, hash: sha(token), createdAt: new Date().toISOString(), lastUsedAt: "", createdBy } as never } });
    return { id, token, ...(await deliverToken(clean, token)) };
}


export async function revokeAgent(id: string): Promise<boolean> {
    const r = await prisma.sectionRecord.deleteMany({ where: { org: ORG, key: KEY, rid: id } });
    return r.count > 0;
}

export type AgentAuth = { state: "ok"; agent: string } | { state: "off" } | { state: "denied" };

/**
 * Кто стучится и можно ли ему это. Токен — из реестра (хеш) или, для совместимости, общий AGENT_BLOG_TOKEN из .env (только право blog).
 * off — доступ агентов вообще не настроен (нет ни одного агента и нет токена в .env); denied — токен неверный или без нужного права.
 */
export async function authorizeAgent(req: Request, scope: AgentScope): Promise<AgentAuth> {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const envToken = process.env.AGENT_BLOG_TOKEN ?? "";
    const envOn = envToken.length >= 24;
    const registered = await prisma.sectionRecord.count({ where: { org: ORG, key: KEY } }).catch(() => 0);
    if (!envOn && !registered) return { state: "off" };
    if (!token) return { state: "denied" };
    if (envOn && scope === "blog") {
        const a = Buffer.from(token), b = Buffer.from(envToken);
        if (a.length === b.length && timingSafeEqual(a, b)) return { state: "ok", agent: "env-token" };
    }
    const hash = sha(token);
    const rows = await prisma.sectionRecord.findMany({ where: { org: ORG, key: KEY, values: { path: ["hash"], equals: hash } as never }, take: 1 });
    const row = rows[0];
    const v = (row?.values ?? {}) as { name?: string; scopes?: string[] };
    if (!row || !v.scopes?.includes(scope)) return { state: "denied" };
    // «последний раз заходил» — для списка в настройках; сбой записи работе не мешает
    void prisma.sectionRecord.update({ where: { id: row.id }, data: { values: { ...(row.values as object), lastUsedAt: new Date().toISOString() } as never } }).catch(() => undefined);
    return { state: "ok", agent: String(v.name ?? "agent") };
}
