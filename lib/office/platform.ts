import { prisma } from "@/lib/prisma";
import { recentErrors } from "@/lib/errorHub";
import { errorBot } from "@/lib/platformSettings";

// Данные для роботов платформы в Робот-офисе (видит только администратор платформы):
//  • Rex (ловля ошибок) — настоящий журнал ошибок платформы (lib/errorHub.ts) и признак, подключён ли Telegram;
//  • Sven (оптимизация сайта) — сигналы SEO-агента из Harness: сторож на сервере (deploy/agentwatch.py) раз в минуту сообщает, когда агент
//    последний раз что-то делал и что писал в журнал.
// Ada (блог) — обычный робот-исполнитель на нашей стороне, тут ей данные не нужны.
export const AGENT_NAMES = ["seo-agent", "article-writer", "mail-sorter"] as const;
export type AgentName = (typeof AGENT_NAMES)[number];
const K_STATUS = "agents:status";

export interface AgentSignal { lastActivity: string; seenAt: string; note: string }
export interface PlatformInfo {
    errors: { telegram: boolean; items: { at: string; title: string; count: number; source: string }[] };
    agents: Partial<Record<AgentName, AgentSignal>>;
}

/** Убираем из строки журнала то, что похоже на ключ или токен: подпись выводится на экране. */
const scrub = (s: string) => s.replace(/\bBearer\s+[-_A-Za-z0-9.=]{8,}/gi, "Bearer ***").replace(/\b(sk|ghp|gho|xox[a-z]|AIza)[-_A-Za-z0-9.]{12,}/g, "***").replace(/[A-Za-z0-9_-]{32,}/g, "***").replace(/\s+/g, " ").trim().slice(0, 140);

export async function recordHeartbeat(agent: string, input: { lastActivity?: string; note?: string }): Promise<boolean> {
    if (!(AGENT_NAMES as readonly string[]).includes(agent)) return false;
    const last = Date.parse(String(input.lastActivity ?? ""));
    const values = { lastActivity: new Date(Number.isFinite(last) ? Math.min(last, Date.now()) : 0).toISOString(), seenAt: new Date().toISOString(), note: scrub(String(input.note ?? "")) };
    const row = await prisma.sectionRecord.findFirst({ where: { org: "platform", key: K_STATUS, rid: agent } });
    if (row) await prisma.sectionRecord.update({ where: { id: row.id }, data: { values: values as never } });
    else await prisma.sectionRecord.create({ data: { org: "platform", key: K_STATUS, rid: agent, values: values as never } });
    return true;
}

export async function platformInfo(): Promise<PlatformInfo> {
    const [items, bot, rows] = await Promise.all([
        recentErrors(6).catch(() => []),
        errorBot().catch(() => ({ botToken: "", chatId: "" })),
        prisma.sectionRecord.findMany({ where: { org: "platform", key: K_STATUS } }).catch(() => []),
    ]);
    const agents: PlatformInfo["agents"] = {};
    for (const r of rows) {
        const v = (r.values ?? {}) as Partial<AgentSignal>;
        if ((AGENT_NAMES as readonly string[]).includes(r.rid)) agents[r.rid as AgentName] = { lastActivity: String(v.lastActivity ?? ""), seenAt: String(v.seenAt ?? ""), note: String(v.note ?? "") };
    }
    return { errors: { telegram: !!(bot.botToken && bot.chatId), items: items.map((i) => ({ at: i.at, title: i.title, count: i.count, source: i.source })) }, agents };
}
