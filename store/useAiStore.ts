import { create } from "zustand";
import { apiCall } from "./crmApi";

export interface AiAction {
	id: string;
	tool: string;
	args: Record<string, unknown>;
	target: string;
	state: "pending" | "running" | "done" | "failed" | "cancelled";
	message?: string; // ошибка или итог (для done — ключ и параметры перевода)
	params?: Record<string, string>;
	link?: string;
}
export interface AiMessage { id: string; role: "user" | "assistant"; text: string; steps?: string[]; actions?: AiAction[]; error?: boolean }
export interface AiStatus { configured: boolean; limit: number; remaining: number; canWrite: boolean; tools: { name: string; write: boolean }[] }

interface AiStore {
	open: boolean;
	messages: AiMessage[];
	busy: boolean;
	status: AiStatus | null;
	draft: string; // текст в поле ввода (подсказки подставляют сюда)
	setDraft: (v: string) => void;
	show: (draft?: string) => void;
	hide: () => void;
	reset: () => void;
	loadStatus: () => Promise<void>;
	send: (text: string, ctx: { locale: string; page: string }) => Promise<void>;
	confirm: (messageId: string, actionId: string, args?: Record<string, unknown>) => Promise<void>;
	cancel: (messageId: string, actionId: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const localNow = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

// Ассистент Firmspace AI. Сообщения живут только в памяти вкладки: история разговора не сохраняется ни на сервере, ни в браузере.
export const useAiStore = create<AiStore>()((set, get) => {
	const patchAction = (mid: string, aid: string, patch: Partial<AiAction>) =>
		set((s) => ({ messages: s.messages.map((m) => (m.id === mid ? { ...m, actions: m.actions?.map((a) => (a.id === aid ? { ...a, ...patch } : a)) } : m)) }));
	return {
		open: false,
		messages: [],
		busy: false,
		status: null,
		draft: "",
		setDraft: (draft) => set({ draft }),
		show: (draft) => { set({ open: true, ...(draft !== undefined ? { draft } : {}) }); get().loadStatus(); },
		hide: () => set({ open: false }),
		reset: () => set({ messages: [], draft: "" }),
		loadStatus: async () => {
			const res = await apiCall<AiStatus>("/api/ai");
			if (res.ok && res.data) set({ status: res.data });
		},
		send: async (text, ctx) => {
			const value = text.trim();
			if (!value || get().busy) return;
			const history = [...get().messages.filter((m) => !m.error), { id: "", role: "user" as const, text: value }].slice(-20).map((m) => ({ role: m.role, text: m.text }));
			set((s) => ({ busy: true, draft: "", messages: [...s.messages, { id: uid(), role: "user", text: value }] }));
			const res = await apiCall<{ reply: string; steps: string[]; actions: Omit<AiAction, "state">[] }>("/api/ai/chat", "POST", { messages: history, locale: ctx.locale, page: ctx.page, now: localNow() });
			if (!res.ok || !res.data) {
				set((s) => ({ busy: false, messages: [...s.messages, { id: uid(), role: "assistant", text: res.message, error: true }] }));
			} else {
				const d = res.data;
				set((s) => ({ busy: false, messages: [...s.messages, { id: uid(), role: "assistant", text: d.reply, steps: Array.from(new Set(d.steps)), actions: d.actions.map((a) => ({ ...a, state: "pending" as const })) }] }));
			}
			get().loadStatus();
		},
		confirm: async (mid, aid, args) => {
			const action = get().messages.find((m) => m.id === mid)?.actions?.find((a) => a.id === aid);
			if (!action || action.state === "running" || action.state === "done") return;
			patchAction(mid, aid, { state: "running" });
			const res = await apiCall<{ params: Record<string, string>; link: string }>("/api/ai/actions", "POST", { tool: action.tool, args: args ?? action.args });
			if (res.ok && res.data) patchAction(mid, aid, { state: "done", params: res.data.params, link: res.data.link });
			else patchAction(mid, aid, { state: "failed", message: res.message });
		},
		cancel: (mid, aid) => patchAction(mid, aid, { state: "cancelled" }),
	};
});
