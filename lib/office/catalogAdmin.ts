import { prisma } from "@/lib/prisma";
import { registeredMarkets } from "@/lib/finance/market";
import { TEMPLATES, ZONES, ACCENTS, SKILL_IDS, isAccent, isSkill, isZone } from "./templates";
import { loadCatalog, resetCatalogCache, type CatalogTemplate } from "./catalog";

// Правка каталога ролей администратором платформы. Входные данные проверяются здесь, не в маршруте: тот же код используют тесты.
export class CatalogError extends Error {}

const CODE_IDS = new Set(TEMPLATES.map((t) => t.id));
const LOCALES = ["de", "en", "ua", "uz"];
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, " ").trim().slice(0, max) : "");

function cleanTexts(v: unknown): Record<string, { title?: string; desc?: string }> {
    const out: Record<string, { title?: string; desc?: string }> = {};
    if (!v || typeof v !== "object") return out;
    for (const l of LOCALES) {
        const e = (v as Record<string, { title?: unknown; desc?: unknown }>)[l];
        if (!e || typeof e !== "object") continue;
        const title = txt(e.title, 60), desc = txt(e.desc, 240);
        if (title || desc) out[l] = { ...(title ? { title } : {}), ...(desc ? { desc } : {}) };
    }
    return out;
}

function cleanRoutines(v: unknown): CatalogTemplate["routines"] {
    if (!Array.isArray(v)) return [];
    const out: CatalogTemplate["routines"] = [];
    for (const r of v.slice(0, 5)) {
        const text = txt((r as { text?: unknown })?.text, 600);
        const time = (r as { time?: unknown })?.time;
        if (!text || typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
        const kind = (r as { kind?: string }).kind;
        out.push({ text, time, kind: kind === "weekdays" || kind === "weekly" || kind === "monthly" ? kind : "daily", ...(typeof (r as { day?: unknown }).day === "number" ? { day: (r as { day: number }).day } : {}) });
    }
    return out;
}

export interface TemplateInput { id?: string; name?: string; zone?: string; accent?: string; skills?: unknown; duties?: string; markets?: unknown; texts?: unknown; routines?: unknown; starter?: boolean; sort?: number; active?: boolean; platform?: boolean }

function normalize(input: TemplateInput, base?: CatalogTemplate) {
    const name = input.name !== undefined ? txt(input.name, 40) : base?.name ?? "";
    if (!name) throw new CatalogError("Name is required");
    const zone = input.zone !== undefined ? input.zone : base?.zone ?? "office";
    if (!isZone(zone)) throw new CatalogError(`Unknown zone. Allowed: ${ZONES.join(", ")}`);
    const accent = input.accent !== undefined ? input.accent : base?.accent ?? "lime";
    if (!isAccent(accent)) throw new CatalogError(`Unknown color. Allowed: ${ACCENTS.join(", ")}`);
    const skills = input.skills !== undefined ? (Array.isArray(input.skills) ? input.skills : []) : base?.skills ?? [];
    if (!skills.length || !skills.every(isSkill)) throw new CatalogError(`Choose skills from: ${SKILL_IDS.join(", ")}`);
    const duties = input.duties !== undefined ? txt(input.duties, 4000) : base?.duties ?? "";
    if (!duties) throw new CatalogError("Duties are required");
    const known = registeredMarkets();
    const markets = input.markets !== undefined ? (Array.isArray(input.markets) ? input.markets.map((m) => String(m).toUpperCase()) : []) : base?.markets ?? [];
    if (markets.some((m) => !known.includes(m))) throw new CatalogError(`Unknown market. Registered: ${known.join(", ")}`);
    return {
        name, zone, accent, skills: Array.from(new Set(skills)) as string[], duties, markets,
        texts: input.texts !== undefined ? cleanTexts(input.texts) : base?.texts ?? {},
        routines: input.routines !== undefined ? cleanRoutines(input.routines) : base?.routines ?? [],
        starter: input.starter ?? base?.starter ?? false,
        sort: Number.isFinite(input.sort) ? Math.trunc(input.sort as number) : base?.sort ?? 100,
        active: input.active ?? base?.active ?? true,
    };
}

export const listTemplatesAdmin = () => loadCatalog();

export async function createTemplate(input: TemplateInput): Promise<CatalogTemplate> {
    const id = txt(input.id, 40).toLowerCase();
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(id)) throw new CatalogError("Id: latin letters, digits and underscore, starting with a letter");
    if ((await loadCatalog()).some((t) => t.id === id) || CODE_IDS.has(id)) throw new CatalogError("This id already exists");
    const v = normalize(input);
    // новые роли — только для найма; роботов платформы заводит код
    await prisma.robotTemplate.create({ data: { id, ...v, platform: false, routines: v.routines as never, texts: v.texts as never } });
    resetCatalogCache();
    return (await loadCatalog()).find((t) => t.id === id) as CatalogTemplate;
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<CatalogTemplate> {
    const cur = (await loadCatalog()).find((t) => t.id === id);
    if (!cur) throw new CatalogError("Template not found");
    const v = normalize(input, cur);
    // роли платформы нельзя ни «сделать обычными», ни отдать для найма: флаг и зона не меняются
    const lock = cur.platform ? { zone: cur.zone } : {};
    await prisma.robotTemplate.update({ where: { id }, data: { ...v, ...lock, routines: v.routines as never, texts: v.texts as never } });
    resetCatalogCache();
    return (await loadCatalog()).find((t) => t.id === id) as CatalogTemplate;
}

/** Удаление: свои роли удаляются, встроенные только отключаются (иначе сид вернул бы их). Уже нанятые роботы остаются. */
export async function removeTemplate(id: string): Promise<"deleted" | "disabled"> {
    const cur = (await loadCatalog()).find((t) => t.id === id);
    if (!cur) throw new CatalogError("Template not found");
    if (CODE_IDS.has(id)) { await prisma.robotTemplate.update({ where: { id }, data: { active: false } }); resetCatalogCache(); return "disabled"; }
    await prisma.robotTemplate.delete({ where: { id } });
    resetCatalogCache();
    return "deleted";
}
