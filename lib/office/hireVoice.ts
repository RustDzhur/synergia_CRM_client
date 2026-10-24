// Найм голосом: диктовка «кого нанять» → черновик робота (имя, должность, навыки, инструкция,
// регулярные задачи, комната). Модель — та же, что у чата Айрис (lib/ai/provider complete), без
// новых ключей. Чистые части (нормализация, разбор ответа) вынесены для юнит-тестов.

import { complete } from "@/lib/ai/provider";
import { OfficeError } from "./store";
import { PICK_SKILLS, PICK_ZONES, isAccent, isSkill, type Accent, type SkillId, type ZoneId } from "./templates";

export interface RoutineDraft { text: string; kind: "daily" | "weekdays" | "weekly" | "monthly"; time: string; day?: number }

export interface RobotDraft {
    name: string;
    title: string;
    skills: SkillId[];
    instructions: string;
    zone: ZoneId;
    accent: Accent;
    routines: RoutineDraft[];
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Упомянута ли реклама в диктовке: от этого зависит предупреждение про Google Ads в форме найма.
// Смотрим слова «ads/ad», «google ads», «реклам…» (ua/ru) и «reklam…» (uz) — языков, на которых диктуют.
export const mentionsAds = (text: string) => /\bads?\b|google\s*ads|реклам|reklam/i.test(text ?? "");

const KINDS = ["daily", "weekdays", "weekly", "monthly"] as const;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Регулярная задача из ответа модели: без текста или времени задачи нет (лимиты — как в createRobot).
export function normalizeRoutine(r: unknown): RoutineDraft | null {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    const text = clean(o.text, 600);
    const kind = (KINDS as readonly string[]).includes(String(o.kind)) ? (o.kind as RoutineDraft["kind"]) : "daily";
    const time = TIME_RE.test(String(o.time ?? "")) ? String(o.time) : "";
    if (!text || !time) return null;
    const day = kind === "weekly" ? Math.min(6, Math.max(0, Number(o.day) || 0)) : kind === "monthly" ? Math.min(28, Math.max(1, Number(o.day) || 1)) : undefined;
    return { text, kind, time, ...(day !== undefined ? { day } : {}) };
}

// Ответ модели → безопасные значения формы найма: навыки только из каталога (служебные blogwrite/monitor
// отбрасываются), длины по лимитам формы, комната и цвет — только из списков.
export function normalizeDraft(raw: unknown): RobotDraft {
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const skills = Array.from(new Set((Array.isArray(o.skills) ? o.skills : []).filter(isSkill).filter((s) => PICK_SKILLS.includes(s))));
    const zone = typeof o.zone === "string" && PICK_ZONES.includes(o.zone as ZoneId) ? (o.zone as ZoneId) : "office";
    return {
        name: clean(o.name, 40) || "Robo",
        title: clean(o.title, 60),
        skills,
        instructions: clean(o.instructions, 1500),
        zone,
        accent: isAccent(o.accent) ? o.accent : "lime",
        routines: (Array.isArray(o.routines) ? o.routines : []).map(normalizeRoutine).filter((r): r is RoutineDraft => !!r).slice(0, 5),
    };
}

// Модель могла обернуть JSON в пояснение или код-блок — берём первые фигурные скобки.
export function parseModelReply(text: string): Record<string, unknown> {
    const m = /\{[\s\S]*\}/.exec(text ?? "");
    if (!m) throw new OfficeError("The AI returned no draft");
    try {
        const v = JSON.parse(m[0]);
        if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch { /* ниже — общая ошибка */ }
    throw new OfficeError("The AI returned no draft");
}

const SYSTEM = [
    "You turn a spoken hiring request into a JSON draft for an AI robot employee of a small-business CRM (the Robot Office).",
    "The owner dictated, in their own language, what the new robot should do.",
    "Reply with ONLY a JSON object, no markdown and no explanation. Exactly these fields:",
    "- name: a short robot first name, max 40 characters",
    "- title: the job title in the owner's language, max 60 characters",
    "- skills: an array of skill ids chosen ONLY from this list: crm, quotes, invoices, finance, stock, purchasing, production, tasks, mail, documents, blog, hr, data, web, ads",
    "- instructions: precise duties for the robot, in English, imperative, max 1500 characters",
    "- zone: one of sales, finance, warehouse, office, marketing, service",
    '- routines: an array of recurring tasks, each with text (string), kind (daily|weekdays|weekly|monthly), time ("HH:MM") and day (number, only for weekly 1-7 or monthly 1-28)',
    "- accent: one of lime, teal, sky, amber, coral, violet",
    "Rules: advertising or Google Ads mentions mean the ads skill and the marketing zone. When a field is unclear, pick a sensible default (name \"Robo\", zone \"office\", routines []). Never invent skills outside the list.",
].join("\n");

/** Диктовка → черновик робота. Ошибки модели/провайдера пробрасываются вызывающему (маршрут). */
export async function parseRobotDraft(text: string): Promise<RobotDraft> {
    const reply = await complete(SYSTEM, [{ role: "user", text: text.slice(0, 4000) }], []);
    return normalizeDraft(parseModelReply(reply.text));
}
