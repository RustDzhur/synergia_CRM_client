import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ExecutedAction, PendingAction } from "@/lib/ai/run";
import { ACCENTS, type Accent, PLATFORM_IDS, STARTER_IDS, TEMPLATES, type SkillId, type ZoneId, isAccent, isSkill, isZone, templateById } from "./templates";

// Роботы, их регулярные задачи и поручения лежат в записях разделов (SectionRecord), как правила автоматизации: отдельной
// миграции базы не нужно. Ключи: office:robot (rid = id робота), office:task (rid = id поручения), office:meta (флаг «стартовый состав нанят»).
const K_ROBOT = "office:robot";
const K_TASK = "office:task";
const K_META = "office:meta";

export class OfficeError extends Error {}

export interface Routine { id: string; text: string; kind: "daily" | "weekdays" | "weekly" | "monthly"; time: string; day?: number; lastRun?: string }
export interface Robot {
    id: string;
    name: string;
    /** Должность. Пусто у роботов из каталога — подпись берётся из перевода шаблона (на языке интерфейса). */
    title: string;
    template: string; // id шаблона или "custom"
    zone: ZoneId;
    accent: Accent;
    skills: SkillId[];
    /** Должностная инструкция (для модели). У робота из каталога пусто — берётся из шаблона. */
    instructions: string;
    autonomy: "ask" | "auto";
    enabled: boolean;
    routines: Routine[];
    createdAt: string;
}

export type TaskStatus = "queued" | "running" | "waiting" | "done" | "failed" | "cancelled";
export interface OfficeTask {
    id: string;
    robot: string; // id робота или "iris" (начальник)
    robotName: string;
    text: string;
    source: "user" | "iris" | "routine" | "drop";
    status: TaskStatus;
    reply: string;
    pending: PendingAction[];
    executed: ExecutedAction[];
    steps: string[];
    error?: string;
    locale?: string;
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
}

export const IRIS_ID = "iris";
export const MAX_ROBOTS = 24;
export const MAX_ROUTINES = 5;
const MAX_TASKS_KEPT = 250;

const rid = (p: string) => `${p}${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
/** Служебные навыки и зона «платформа» есть только у роботов платформы: своему роботу их выдать нельзя. */
const ownSkill = (v: unknown): v is SkillId => isSkill(v) && v !== "monitor" && v !== "blogwrite";
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const cleanLong = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, " ").trim().slice(0, max) : "");

// ── роботы ─────────────────────────────────────────────────────────────────────

const toRobot = (r: { rid: string; values: unknown; createdAt: Date }): Robot => {
    const v = (r.values ?? {}) as Partial<Robot>;
    return {
        id: r.rid,
        name: String(v.name ?? ""),
        title: String(v.title ?? ""),
        template: String(v.template ?? "custom"),
        zone: isZone(v.zone) ? v.zone : "office",
        accent: isAccent(v.accent) ? v.accent : "lime",
        skills: (Array.isArray(v.skills) ? v.skills : []).filter(isSkill),
        instructions: String(v.instructions ?? ""),
        autonomy: v.autonomy === "auto" ? "auto" : "ask",
        enabled: v.enabled !== false,
        routines: Array.isArray(v.routines) ? (v.routines as Routine[]).filter((x) => x && typeof x.id === "string") : [],
        createdAt: r.createdAt.toISOString(),
    };
};

const robotValues = (r: Robot) => ({ name: r.name, title: r.title, template: r.template, zone: r.zone, accent: r.accent, skills: r.skills, instructions: r.instructions, autonomy: r.autonomy, enabled: r.enabled, routines: r.routines });

export async function listRobots(org: string): Promise<Robot[]> {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key: K_ROBOT }, orderBy: { createdAt: "asc" } });
    return rows.map(toRobot);
}

export async function getRobot(org: string, id: string): Promise<Robot | null> {
    const row = await prisma.sectionRecord.findFirst({ where: { org, key: K_ROBOT, rid: id } });
    return row ? toRobot(row) : null;
}

export interface RobotInput { template?: string; name?: string; title?: string; zone?: string; accent?: string; skills?: unknown; instructions?: string; autonomy?: string; enabled?: boolean }

/** Нанимает робота: из шаблона каталога или своего («custom»). Для шаблона пустые поля берутся из него. */
export async function createRobot(org: string, input: RobotInput, opts: { platform?: boolean } = {}): Promise<Robot> {
    if ((await prisma.sectionRecord.count({ where: { org, key: K_ROBOT } })) >= MAX_ROBOTS) throw new OfficeError(`At most ${MAX_ROBOTS} robots`);
    const tpl = input.template && input.template !== "custom" ? templateById(input.template) : null;
    if (input.template && input.template !== "custom" && !tpl) throw new OfficeError("Unknown robot template");
    if (tpl?.platform && !opts.platform) throw new OfficeError("Unknown robot template"); // роботов платформы нанимает только сама платформа
    const name = clean(input.name, 40) || tpl?.name || "";
    if (!name) throw new OfficeError("Robot name is required");
    const skills = tpl && !Array.isArray(input.skills) ? tpl.skills : (Array.isArray(input.skills) ? input.skills : []).filter(tpl?.platform ? isSkill : ownSkill);
    if (!skills.length) throw new OfficeError("Choose at least one skill");
    const robot: Robot = {
        id: rid("r"),
        name,
        title: clean(input.title, 60),
        template: tpl?.id ?? "custom",
        zone: tpl?.platform ? "platform" : isZone(input.zone) && input.zone !== "platform" ? input.zone : tpl?.zone ?? "office",
        accent: isAccent(input.accent) ? input.accent : tpl?.accent ?? ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
        skills: Array.from(new Set(skills)),
        instructions: cleanLong(input.instructions, 1500),
        autonomy: input.autonomy === "auto" || tpl?.platform ? "auto" : "ask",
        enabled: input.enabled !== false,
        routines: (tpl?.routines ?? []).map((r) => cleanRoutine(r)).filter((r): r is Routine => !!r),
        createdAt: new Date().toISOString(),
    };
    if (!tpl && !robot.title && !robot.instructions) throw new OfficeError("Describe the job: give a title or instructions");
    const row = await prisma.sectionRecord.create({ data: { org, key: K_ROBOT, rid: robot.id, values: robotValues(robot) as never } });
    return { ...robot, createdAt: row.createdAt.toISOString() };
}

const cleanRoutine = (x: unknown): Routine | null => {
    const r = x as Partial<Routine> | null;
    const text = clean(r?.text, 600);
    const time = typeof r?.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : "";
    const kind = r?.kind === "weekdays" || r?.kind === "weekly" || r?.kind === "monthly" ? r.kind : "daily";
    if (!text || !time) return null;
    const day = kind === "weekly" ? Math.min(6, Math.max(0, Number(r?.day) || 0)) : kind === "monthly" ? Math.min(28, Math.max(1, Number(r?.day) || 1)) : undefined;
    return { id: typeof r?.id === "string" && /^[\w-]{3,24}$/.test(r.id) ? r.id : rid("n"), text, kind, time, ...(day !== undefined ? { day } : {}), ...(typeof r?.lastRun === "string" ? { lastRun: r.lastRun.slice(0, 10) } : {}) };
};

export async function updateRobot(org: string, id: string, patch: RobotInput & { routines?: unknown }): Promise<Robot> {
    const cur = await getRobot(org, id);
    if (!cur) throw new OfficeError("Robot not found");
    const next: Robot = { ...cur };
    if (patch.name !== undefined) { next.name = clean(patch.name, 40); if (!next.name) throw new OfficeError("Robot name is required"); }
    if (patch.title !== undefined) next.title = clean(patch.title, 60);
    const fixed = !!templateById(cur.template)?.platform; // роботу платформы зону и навыки не меняют
    if (patch.zone !== undefined && !fixed) { if (!isZone(patch.zone) || patch.zone === "platform") throw new OfficeError("Unknown zone"); next.zone = patch.zone; }
    if (patch.accent !== undefined) { if (!isAccent(patch.accent)) throw new OfficeError("Unknown color"); next.accent = patch.accent; }
    if (patch.skills !== undefined && !fixed) {
        next.skills = Array.from(new Set((Array.isArray(patch.skills) ? patch.skills : []).filter(ownSkill)));
        if (!next.skills.length) throw new OfficeError("Choose at least one skill");
    }
    if (patch.instructions !== undefined) next.instructions = cleanLong(patch.instructions, 1500);
    if (patch.autonomy !== undefined) next.autonomy = patch.autonomy === "auto" ? "auto" : "ask";
    if (patch.enabled !== undefined) next.enabled = patch.enabled !== false;
    if (patch.routines !== undefined) {
        const list = (Array.isArray(patch.routines) ? patch.routines : []).map(cleanRoutine).filter((x): x is Routine => !!x);
        if (list.length > MAX_ROUTINES) throw new OfficeError(`At most ${MAX_ROUTINES} regular tasks per robot`);
        // дата последнего запуска серверная: клиент не должен ни сбросить, ни выдумать её
        next.routines = list.map((r) => ({ ...r, lastRun: cur.routines.find((o) => o.id === r.id)?.lastRun }));
    }
    await prisma.sectionRecord.updateMany({ where: { org, key: K_ROBOT, rid: id }, data: { values: robotValues(next) as never } });
    return next;
}

/** Увольнение: робот удаляется, его очередь отменяется; готовые поручения остаются в истории. */
export async function deleteRobot(org: string, id: string): Promise<void> {
    const n = (await prisma.sectionRecord.deleteMany({ where: { org, key: K_ROBOT, rid: id } })).count;
    if (!n) throw new OfficeError("Robot not found");
    const open = await listTasks(org, 300);
    for (const t of open) if (t.robot === id && (t.status === "queued" || t.status === "waiting")) await updateTask(org, t.id, { status: "cancelled", finishedAt: new Date().toISOString(), error: "The robot was dismissed" });
}

/** Первый раз в разделе — нанимаем стартовый состав. Один раз на фирму: уволить всех и остаться с пустым офисом можно. */
export async function ensureStarters(org: string): Promise<boolean> {
    const meta = await prisma.sectionRecord.findFirst({ where: { org, key: K_META, rid: "meta" } });
    if (meta) return false;
    // отметка ставится до найма: параллельное открытие раздела не наймёт состав второй раз
    try { await prisma.sectionRecord.create({ data: { org, key: K_META, rid: "meta", values: { starters: new Date().toISOString() } as never } }); } catch { return false; }
    if ((await prisma.sectionRecord.count({ where: { org, key: K_ROBOT } })) > 0) return false;
    for (const id of STARTER_IDS) {
        const tpl = TEMPLATES.find((t) => t.id === id);
        if (tpl) await createRobot(org, { template: tpl.id });
    }
    return true;
}

/** Роботы платформы (ловля ошибок, оптимизация сайта, блог) — один раз на фирму администратора платформы. Уволить можно, повторно не нанимаются. */
export async function ensurePlatformRobots(org: string): Promise<boolean> {
    const mark = await prisma.sectionRecord.findFirst({ where: { org, key: K_META, rid: "platform" } });
    if (mark) return false;
    try { await prisma.sectionRecord.create({ data: { org, key: K_META, rid: "platform", values: { at: new Date().toISOString() } as never } }); } catch { return false; }
    const have = new Set((await listRobots(org)).map((r) => r.template));
    for (const id of PLATFORM_IDS) {
        if (have.has(id)) continue;
        await createRobot(org, { template: id }, { platform: true }).catch(() => undefined);
    }
    return true;
}

// ── поручения ──────────────────────────────────────────────────────────────────

const toTask = (r: { rid: string; values: unknown }): OfficeTask => {
    const v = (r.values ?? {}) as Partial<OfficeTask>;
    return {
        id: r.rid,
        robot: String(v.robot ?? ""),
        robotName: String(v.robotName ?? ""),
        text: String(v.text ?? ""),
        source: v.source === "iris" || v.source === "routine" || v.source === "drop" ? v.source : "user",
        status: (["queued", "running", "waiting", "done", "failed", "cancelled"] as string[]).includes(String(v.status)) ? (v.status as TaskStatus) : "failed",
        reply: String(v.reply ?? ""),
        pending: Array.isArray(v.pending) ? (v.pending as PendingAction[]) : [],
        executed: Array.isArray(v.executed) ? (v.executed as ExecutedAction[]) : [],
        steps: Array.isArray(v.steps) ? (v.steps as string[]) : [],
        ...(v.error ? { error: String(v.error) } : {}),
        ...(v.locale ? { locale: String(v.locale) } : {}),
        createdAt: String(v.createdAt ?? ""),
        ...(v.startedAt ? { startedAt: String(v.startedAt) } : {}),
        ...(v.finishedAt ? { finishedAt: String(v.finishedAt) } : {}),
    };
};

export async function listTasks(org: string, limit = 80): Promise<OfficeTask[]> {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key: K_TASK }, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(toTask);
}

export async function getTask(org: string, id: string): Promise<OfficeTask | null> {
    const row = await prisma.sectionRecord.findFirst({ where: { org, key: K_TASK, rid: id } });
    return row ? toTask(row) : null;
}

export async function createTask(org: string, input: { robot: string; robotName: string; text: string; source: OfficeTask["source"]; locale?: string }): Promise<OfficeTask> {
    const task: OfficeTask = {
        id: rid("t"), robot: input.robot, robotName: input.robotName, text: cleanLong(input.text, 30000), source: input.source, status: "queued",
        reply: "", pending: [], executed: [], steps: [], ...(input.locale ? { locale: clean(input.locale, 8) } : {}), createdAt: new Date().toISOString(),
    };
    if (!task.text) throw new OfficeError("Task text is required");
    const { id, ...values } = task;
    await prisma.sectionRecord.create({ data: { org, key: K_TASK, rid: id, values: values as never } });
    void pruneTasks(org).catch(() => undefined);
    return task;
}

export async function updateTask(org: string, id: string, patch: Partial<Omit<OfficeTask, "id">>): Promise<OfficeTask | null> {
    const cur = await getTask(org, id);
    if (!cur) return null;
    const { id: _id, ...values } = { ...cur, ...patch };
    await prisma.sectionRecord.updateMany({ where: { org, key: K_TASK, rid: id }, data: { values: values as never } });
    return { ...cur, ...patch };
}

export async function deleteFinishedTasks(org: string): Promise<number> {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key: K_TASK } });
    const ids = rows.filter((r) => ["done", "failed", "cancelled"].includes(String((r.values as { status?: string })?.status))).map((r) => r.rid);
    if (!ids.length) return 0;
    return (await prisma.sectionRecord.deleteMany({ where: { org, key: K_TASK, rid: { in: ids } } })).count;
}

// История не растёт бесконечно: храним последние поручения, самые старые завершённые убираем
async function pruneTasks(org: string) {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key: K_TASK }, orderBy: { createdAt: "desc" }, skip: MAX_TASKS_KEPT, take: 100 });
    const old = rows.filter((r) => ["done", "failed", "cancelled"].includes(String((r.values as { status?: string })?.status))).map((r) => r.rid);
    if (old.length) await prisma.sectionRecord.deleteMany({ where: { org, key: K_TASK, rid: { in: old } } });
}
