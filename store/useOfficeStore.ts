import { create } from "zustand";
import toast from "react-hot-toast";
import { apiCall } from "./crmApi";

// Робот-офис на клиенте (сервер — lib/office). Данные обновляются опросом: часто, пока кто-то работает или ждёт, и редко в покое.
export type Skill = "crm" | "quotes" | "invoices" | "finance" | "stock" | "purchasing" | "production" | "tasks" | "mail" | "documents" | "blog" | "hr" | "data";
export type Zone = "sales" | "finance" | "warehouse" | "office" | "marketing" | "service";
export type Accent = "lime" | "teal" | "sky" | "amber" | "coral" | "violet";
export interface Routine { id: string; text: string; kind: "daily" | "weekdays" | "weekly" | "monthly"; time: string; day?: number; lastRun?: string }
export interface Robot { id: string; name: string; title: string; template: string; zone: Zone; accent: Accent; skills: Skill[]; instructions: string; autonomy: "ask" | "auto"; enabled: boolean; routines: Routine[]; createdAt: string }
export type TaskStatus = "queued" | "running" | "waiting" | "done" | "failed" | "cancelled";
export interface OfficeAction { id: string; tool: string; args: Record<string, unknown>; target: string; state?: "done" | "failed"; params?: Record<string, string>; link?: string; message?: string }
export interface OfficeTask { id: string; robot: string; robotName: string; text: string; source: "user" | "iris" | "routine" | "drop"; status: TaskStatus; reply: string; pending: OfficeAction[]; executed: OfficeAction[]; steps: string[]; error?: string; createdAt: string; startedAt?: string; finishedAt?: string }
export interface RobotInput { template?: string; name?: string; title?: string; zone?: Zone; accent?: Accent; skills?: Skill[]; instructions?: string; autonomy?: "ask" | "auto"; enabled?: boolean; routines?: Omit<Routine, "id" | "lastRun">[] & Partial<Pick<Routine, "id">>[] }

interface OfficeStore {
    robots: Robot[];
    tasks: OfficeTask[];
    loaded: boolean;
    ai: boolean;
    canEdit: boolean;
    maxRobots: number;
    selected: string | null;
    select: (id: string | null) => void;
    load: () => Promise<void>;
    hire: (input: RobotInput) => Promise<Robot | null>;
    update: (id: string, patch: RobotInput) => Promise<boolean>;
    dismiss: (id: string) => Promise<boolean>;
    assign: (robot: string, text: string, locale: string, source?: "user" | "drop") => Promise<OfficeTask | null>;
    decide: (taskId: string, action: "confirm" | "reject" | "cancel", ids?: string[]) => Promise<boolean>;
    reassign: (taskId: string, robot: string) => Promise<boolean>;
    clearDone: () => Promise<void>;
}

const fail = (message: string) => { toast.error(message); return false; };

export const useOfficeStore = create<OfficeStore>()((set, get) => {
    const replaceTask = (t: OfficeTask) => set((s) => ({ tasks: s.tasks.some((x) => x.id === t.id) ? s.tasks.map((x) => (x.id === t.id ? t : x)) : [t, ...s.tasks] }));
    return {
        robots: [], tasks: [], loaded: false, ai: true, canEdit: true, maxRobots: 24, selected: null,
        select: (id) => set({ selected: id }),

        load: async () => {
            const r = await apiCall<{ robots: Robot[]; tasks: OfficeTask[]; ai: boolean; canEdit: boolean; maxRobots: number }>("/api/office", "GET", undefined, { cache: "no-store" });
            if (r.ok && r.data) set({ robots: r.data.robots, tasks: r.data.tasks, ai: r.data.ai, canEdit: r.data.canEdit, maxRobots: r.data.maxRobots, loaded: true });
            else set({ loaded: true });
        },

        hire: async (input) => {
            const r = await apiCall<Robot>("/api/office/robots", "POST", input);
            if (!r.ok || !r.data) return void fail(r.message) ?? null;
            set((s) => ({ robots: [...s.robots, r.data!], selected: r.data!.id }));
            return r.data;
        },

        update: async (id, patch) => {
            const before = get().robots;
            // зона и включённость меняются сразу (перетаскивание должно «прилипать»), при отказе откатываем
            set({ robots: before.map((x) => (x.id === id ? { ...x, ...(patch.zone ? { zone: patch.zone } : {}), ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}) } : x)) });
            const r = await apiCall<Robot>(`/api/office/robots/${id}`, "PATCH", patch);
            if (!r.ok || !r.data) { set({ robots: before }); return fail(r.message); }
            set((s) => ({ robots: s.robots.map((x) => (x.id === id ? r.data! : x)) }));
            return true;
        },

        dismiss: async (id) => {
            const r = await apiCall<{ ok: boolean }>(`/api/office/robots/${id}`, "DELETE");
            if (!r.ok) return fail(r.message);
            set((s) => ({ robots: s.robots.filter((x) => x.id !== id), selected: s.selected === id ? null : s.selected }));
            void get().load();
            return true;
        },

        assign: async (robot, text, locale, source = "user") => {
            const r = await apiCall<OfficeTask>("/api/office/tasks", "POST", { robot, text, locale, source });
            if (!r.ok || !r.data) return void fail(r.code === "not_configured" ? r.message : r.message) ?? null;
            replaceTask(r.data);
            return r.data;
        },

        decide: async (taskId, action, ids) => {
            const r = await apiCall<OfficeTask>(`/api/office/tasks/${taskId}`, "POST", { action, ids });
            if (!r.ok || !r.data) return fail(r.message);
            replaceTask(r.data);
            return true;
        },

        reassign: async (taskId, robot) => {
            const r = await apiCall<OfficeTask>(`/api/office/tasks/${taskId}`, "POST", { action: "reassign", robot });
            if (!r.ok || !r.data) return fail(r.message);
            await get().load();
            return true;
        },

        clearDone: async () => {
            await apiCall("/api/office/tasks", "DELETE");
            await get().load();
        },
    };
});
