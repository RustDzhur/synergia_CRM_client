import type { Accent, OfficeTask, Robot, TaskStatus } from "@/store/useOfficeStore";

// Цвета роботов — спокойные оттенки палитры платформы (салатовый акцент, бирюзовый, янтарный и т.д.)
export const ACCENT_HEX: Record<Accent, string> = { lime: "#c6ff4d", teal: "#2DDEB6", sky: "#7CC4FF", amber: "#F4A100", coral: "#FF8A7A", violet: "#B8A2FF" };
export const ACCENTS = Object.keys(ACCENT_HEX) as Accent[];

export const STATUS_COLOR: Record<TaskStatus, string> = { queued: "#8c948b", running: "#c6ff4d", waiting: "#F4A100", done: "#2DDEB6", failed: "#EB5757", cancelled: "#8c948b" };

export type RobotState = "idle" | "working" | "waiting" | "failed" | "off";

export interface RobotView { state: RobotState; running?: OfficeTask; queued: number; waiting: number }

const FAILED_VISIBLE_MS = 30 * 60 * 1000;

/** Что сейчас с роботом, по его поручениям (tasks — новые первыми). */
export function viewOf(robot: Robot, tasks: OfficeTask[], now = Date.now()): RobotView {
    const mine = tasks.filter((t) => t.robot === robot.id);
    const running = mine.find((t) => t.status === "running");
    const queued = mine.filter((t) => t.status === "queued").length;
    const waiting = mine.filter((t) => t.status === "waiting").length;
    if (!robot.enabled) return { state: "off", queued, waiting };
    if (running) return { state: "working", running, queued, waiting };
    if (queued) return { state: "working", queued, waiting };
    if (waiting) return { state: "waiting", queued, waiting };
    const last = mine[0];
    if (last?.status === "failed" && Date.now() - Date.parse(last.finishedAt ?? last.createdAt) < FAILED_VISIBLE_MS && now) return { state: "failed", queued, waiting };
    return { state: "idle", queued, waiting };
}

/** Подпись должности: у роботов из каталога — перевод шаблона, у своих — то, что ввёл человек. */
export function titleOf(t: (k: string) => string, r: Pick<Robot, "template" | "title">): string {
    return r.title || (r.template !== "custom" ? t(`tpl_${r.template}_title`) : "");
}
