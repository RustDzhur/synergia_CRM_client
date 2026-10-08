import { prisma } from "@/lib/prisma";
import { TEMPLATES, STARTER_IDS, isAccent, isSkill, isZone, type Accent, type RobotTemplate as CodeTemplate, type SkillId, type ZoneId } from "./templates";

// Каталог ролей роботов. Источник — таблица robot_templates (правит администратор платформы без выкладки).
// lib/office/templates.ts остаётся только сидом: недостающие роли добавляются один раз, правки администратора сид не затирает.
// Если таблицы ещё нет (схема не накатана) или база недоступна, каталог берётся из кода — офис работает как раньше.

export interface CatalogTemplate {
    id: string;
    name: string;
    zone: ZoneId;
    accent: Accent;
    skills: SkillId[];
    duties: string;
    platform: boolean;
    routines: NonNullable<CodeTemplate["routines"]>;
    markets: string[];
    texts: Record<string, { title?: string; desc?: string }>;
    starter: boolean;
    sort: number;
    active: boolean;
}

const fromCode = (t: CodeTemplate, i: number): CatalogTemplate => ({
    id: t.id, name: t.name, zone: t.zone, accent: t.accent, skills: t.skills, duties: t.duties, platform: !!t.platform,
    routines: t.routines ?? [], markets: [], texts: {}, starter: STARTER_IDS.includes(t.id), sort: i, active: true,
});

const CODE: CatalogTemplate[] = TEMPLATES.map(fromCode);

type Row = { id: string; name: string; zone: string; accent: string; skills: string[]; duties: string; platform: boolean; routines: unknown; markets: string[]; texts: unknown; starter: boolean; sort: number; active: boolean };
const fromRow = (r: Row): CatalogTemplate => ({
    id: r.id, name: r.name, zone: isZone(r.zone) ? r.zone : "office", accent: isAccent(r.accent) ? r.accent : "lime", skills: r.skills.filter(isSkill), duties: r.duties,
    platform: r.platform, routines: Array.isArray(r.routines) ? (r.routines as CatalogTemplate["routines"]) : [], markets: r.markets,
    texts: r.texts && typeof r.texts === "object" ? (r.texts as CatalogTemplate["texts"]) : {}, starter: r.starter, sort: r.sort, active: r.active,
});

const TTL = 30_000;
const g = globalThis as { __robotCatalog?: { at: number; list: CatalogTemplate[] }; __robotSeeded?: boolean };

/** Сбросить кэш (после правки каталога администратором и в тестах). */
export const resetCatalogCache = () => { g.__robotCatalog = undefined; };

async function seedMissing(): Promise<void> {
    if (g.__robotSeeded) return;
    const have = new Set((await prisma.robotTemplate.findMany({ select: { id: true } })).map((r) => r.id));
    const missing = CODE.filter((t) => !have.has(t.id));
    if (missing.length) {
        await prisma.robotTemplate.createMany({
            data: missing.map((t) => ({ id: t.id, name: t.name, zone: t.zone, accent: t.accent, skills: t.skills, duties: t.duties, platform: t.platform, routines: t.routines as never, markets: t.markets, starter: t.starter, sort: t.sort })),
            skipDuplicates: true,
        });
    }
    g.__robotSeeded = true;
}

/** Весь каталог (включая отключённые и платформенные роли). */
export async function loadCatalog(): Promise<CatalogTemplate[]> {
    const c = g.__robotCatalog;
    if (c && Date.now() - c.at < TTL) return c.list;
    let list = CODE;
    try {
        await seedMissing();
        const rows = await prisma.robotTemplate.findMany({ orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
        if (rows.length) list = rows.map(fromRow);
    } catch {
        // таблицы нет или база недоступна — каталог из кода
    }
    g.__robotCatalog = { at: Date.now(), list };
    return list;
}

export async function catalogById(id: string): Promise<CatalogTemplate | null> {
    return (await loadCatalog()).find((t) => t.id === id) ?? null;
}

/** Роль робота платформы? Платформенные роли определяются и по коду (их нельзя «разжаловать» правкой записи). */
export async function isPlatformTemplate(id: string): Promise<boolean> {
    if (CODE.find((t) => t.id === id)?.platform) return true;
    return !!(await catalogById(id))?.platform;
}

/** Каталог для найма на рынке фирмы: активные не платформенные роли, подходящие рынку. */
export async function hireCatalog(market: string | null): Promise<CatalogTemplate[]> {
    return (await loadCatalog()).filter((t) => t.active && !t.platform && (!t.markets.length || (!!market && t.markets.includes(market))));
}

export async function starterIds(market: string | null): Promise<string[]> {
    return (await hireCatalog(market)).filter((t) => t.starter).map((t) => t.id);
}
