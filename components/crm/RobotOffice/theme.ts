import { type Accent, type OfficeTask, type PlatformInfo, type Robot, type TaskStatus, useOfficeStore } from "@/store/useOfficeStore";

// Цвета роботов — спокойные оттенки палитры платформы (салатовый акцент, бирюзовый, янтарный и т.д.)
export const ACCENT_HEX: Record<Accent, string> = { lime: "#c6ff4d", teal: "#2DDEB6", sky: "#7CC4FF", amber: "#F4A100", coral: "#FF8A7A", violet: "#B8A2FF" };
export const ACCENTS = Object.keys(ACCENT_HEX) as Accent[];

export const STATUS_COLOR: Record<TaskStatus, string> = { queued: "#8c948b", running: "#c6ff4d", waiting: "#F4A100", done: "#2DDEB6", failed: "#EB5757", cancelled: "#8c948b" };

export type RobotState = "idle" | "working" | "waiting" | "failed" | "off";

/** Робот-наблюдатель платформы (ловля ошибок, оптимизация сайта): сидит за компьютером всегда, «работает», когда есть свежий сигнал. */
export interface MonitorView { kind: "errors" | "seo"; /** подпись над головой; пусто — «слежу» */ text: string; /** есть связь с источником (для SEO — сигнал от агента Харнеса не старше 15 минут) */ linked: boolean }
export interface RobotView { state: RobotState; running?: OfficeTask; queued: number; waiting: number; monitor?: MonitorView }

/** Роботы платформы, которые только наблюдают (у них нет поручений). */
export const isMonitor = (robot: Pick<Robot, "template">) => robot.template === "p_errors" || robot.template === "p_seo";
/** Любой робот платформы сидит за своим столом постоянно. */
export const isPlatformRobot = (robot: Pick<Robot, "template">) => robot.template.startsWith("p_");

const ERROR_FRESH_MS = 30 * 60 * 1000;
const AGENT_ACTIVE_MS = 10 * 60 * 1000;
const AGENT_SEEN_MS = 15 * 60 * 1000;

function monitorView(robot: Robot, platform: PlatformInfo | null, now: number): RobotView {
    if (!robot.enabled) return { state: "off", queued: 0, waiting: 0 };
    if (robot.template === "p_errors") {
        const fresh = (platform?.errors.items ?? []).filter((i) => now - Date.parse(i.at) < ERROR_FRESH_MS);
        return { state: fresh.length ? "working" : "idle", queued: 0, waiting: 0, monitor: { kind: "errors", text: fresh[0]?.title ?? "", linked: !!platform } };
    }
    const sig = platform?.agents["seo-agent"];
    const active = !!sig && now - Date.parse(sig.lastActivity) < AGENT_ACTIVE_MS;
    const seen = !!sig && now - Date.parse(sig.seenAt) < AGENT_SEEN_MS;
    return { state: active ? "working" : "idle", queued: 0, waiting: 0, monitor: { kind: "seo", text: active ? sig!.note : "", linked: seen } };
}

const FAILED_VISIBLE_MS = 30 * 60 * 1000;

/** Что сейчас с роботом, по его поручениям (tasks — новые первыми). */
export function viewOf(robot: Robot, tasks: OfficeTask[], now = Date.now(), platform: PlatformInfo | null = useOfficeStore.getState().platform): RobotView {
    if (isMonitor(robot)) return monitorView(robot, platform, now);
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
