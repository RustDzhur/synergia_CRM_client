import { prisma } from "@/lib/prisma";

// Проверка запроса специалиста практики (role advisor / counsel) на действующую связь. Вызывается из requireUser на каждом запросе
// такого пользователя, без кэша: отзыв, истечение срока и уход сотрудника из практики действуют немедленно.
//
// Уровни доступа связи:
//   read   — только чтение (GET/HEAD);
//   review — чтение + проверка документов (маршруты /api/review/*);
//   edit   — запись в выданных разделах.
// Настройки реквизитов фирмы специалист не меняет ни на каком уровне.

const WRITE_FORBIDDEN_PREFIXES = ["/api/finance/settings"];

export interface GateResult { ok: boolean; link?: string }

export async function practiceGate(membership: { org: string; user: string; link?: string | null }, pathname: string, method: string): Promise<GateResult> {
    if (!membership.link) return { ok: false };
    const link = await prisma.clientLink.findUnique({ where: { id: membership.link } });
    if (!link || link.status !== "active" || link.org !== membership.org) return { ok: false };
    if (link.expiresAt && link.expiresAt < new Date()) return { ok: false };
    if (!link.members.includes(membership.user)) return { ok: false };
    if (!(await prisma.practiceMember.findFirst({ where: { practice: link.practice, user: membership.user } }))) return { ok: false };
    const read = method === "GET" || method === "HEAD";
    if (!read) {
        if (link.access === "read") return { ok: false };
        if (link.access === "review" && !pathname.startsWith("/api/review/")) return { ok: false };
        if (WRITE_FORBIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return { ok: false };
    }
    return { ok: true, link: link.id };
}

const lastRead = new Map<string, number>();
const READ_LOG_EVERY_MS = 10 * 60_000;

/** Запись в журнал доступа. Каждая запись/изменение — отдельной строкой; чтения одного раздела — не чаще раза в 10 минут. */
export async function recordAccess(entry: { org: string; link: string; user: string; userName: string; module: string; method: string; path: string }): Promise<void> {
    const write = !(entry.method === "GET" || entry.method === "HEAD");
    if (!write) {
        const key = `${entry.link}:${entry.user}:${entry.module}`;
        const now = Date.now();
        if (now - (lastRead.get(key) ?? 0) < READ_LOG_EVERY_MS) return;
        lastRead.set(key, now);
    }
    try {
        await prisma.accessLogEntry.create({ data: { ...entry, action: write ? "write" : "read", path: entry.path.slice(0, 200) } });
    } catch { /* журнал не должен ронять запрос */ }
}
