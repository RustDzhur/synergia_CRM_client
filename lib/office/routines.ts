import { prisma } from "@/lib/prisma";
import { orgFeatures } from "@/lib/features";
import type { Robot, Routine } from "./store";
import { startOfficeTask } from "./runner";

// Регулярные задачи роботов: «каждое утро в 9:00 проверь просроченные счета». Раз в минуту сервер смотрит, чья пора, и ставит
// поручение роботу как обычное (с теми же подтверждениями). Время — по часовому поясу фирмы: Германия — Europe/Berlin, Украина — Europe/Kyiv.
// Запуск за день один: дата последнего запуска записывается до постановки поручения.

const LATE_WINDOW_MIN = 6 * 60; // сервер был недоступен — выполняем с опозданием до 6 часов, а не пропускаем

const ZONES: Record<string, string> = { UA: "Europe/Kyiv", UZ: "Asia/Tashkent" };
export const timeZoneFor = (country?: string | null) => ZONES[String(country ?? "").toUpperCase()] ?? "Europe/Berlin";

/** Местные дата, время и день недели (0 — воскресенье) в поясе фирмы. */
export function localParts(now: Date, timeZone: string) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(now).map((p) => [p.type, p.value]));
    const hour = parts.hour === "24" ? "00" : parts.hour;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(hour) * 60 + Number(parts.minute), time: `${hour}:${parts.minute}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday), dayOfMonth: Number(parts.day) };
}

/** Пора ли выполнить регулярную задачу сейчас. */
export function isDue(r: Routine, now: Date, timeZone: string): boolean {
    const l = localParts(now, timeZone);
    if (r.lastRun === l.date) return false;
    const [h, m] = r.time.split(":").map(Number);
    const at = h * 60 + m;
    if (l.minutes < at || l.minutes - at > LATE_WINDOW_MIN) return false;
    if (r.kind === "weekdays") return l.weekday >= 1 && l.weekday <= 5;
    if (r.kind === "weekly") return l.weekday === (r.day ?? 1);
    if (r.kind === "monthly") return l.dayOfMonth === (r.day ?? 1);
    return true;
}

/** Один обход: ставит поручения всем, чья пора. Возвращает, сколько запущено. */
export async function runDueRoutines(now = new Date()): Promise<number> {
    const rows = await prisma.sectionRecord.findMany({ where: { key: "office:robot" }, take: 5000 });
    const withRoutines = rows.filter((r) => Array.isArray((r.values as { routines?: unknown[] })?.routines) && ((r.values as { routines: unknown[] }).routines.length > 0) && (r.values as { enabled?: boolean }).enabled !== false);
    let started = 0;
    const orgs = new Map<string, { zone: string; ok: boolean; owner: string; name: string } | null>();
    for (const row of withRoutines) {
        let o = orgs.get(row.org);
        if (o === undefined) {
            const org = await prisma.organization.findUnique({ where: { id: row.org } });
            const fin = org ? await prisma.financeSettings.findUnique({ where: { org: row.org }, select: { country: true } }).catch(() => null) : null;
            // раздел должен быть в тарифе, фирма не заблокирована
            o = org && !org.blocked && orgFeatures(org).automation ? { zone: timeZoneFor(fin?.country), ok: true, owner: String(org.ownerUser ?? ""), name: org.name } : null;
            orgs.set(row.org, o);
        }
        if (!o) continue;
        const v = row.values as Partial<Robot>;
        for (const routine of (v.routines ?? []) as Routine[]) {
            if (!isDue(routine, now, o.zone)) continue;
            const l = localParts(now, o.zone);
            try {
                // сначала отметка «сегодня запускали», потом поручение: при сбое лучше пропустить день, чем запустить дважды
                const routines = ((v.routines ?? []) as Routine[]).map((x) => (x.id === routine.id ? { ...x, lastRun: l.date } : x));
                await prisma.sectionRecord.updateMany({ where: { id: row.id }, data: { values: { ...(row.values as object), routines } as never } });
                const ctx = { org: row.org, platformAdmin: true, userId: o.owner, role: "owner" as const, modules: [] as string[], today: l.date, now: `${l.date}T${l.time}`, orgName: o.name };
                await startOfficeTask(ctx, { robot: row.rid, text: routine.text, source: "routine" });
                started++;
            } catch { /* поручение не создано (робота выключили, нет ИИ) — завтра попробуем снова */ }
        }
    }
    return started;
}

/** Раз в минуту — только в серверном процессе (instrumentation.node.ts). Двойной запуск исключён флагом и датой последнего запуска. */
export function startRoutineScheduler() {
    const g = globalThis as { __officeScheduler?: boolean };
    if (g.__officeScheduler) return;
    g.__officeScheduler = true;
    const timer = setInterval(() => { void runDueRoutines().catch((e) => console.error("office routines:", e instanceof Error ? e.message : e)); }, 60_000);
    timer.unref?.();
}

