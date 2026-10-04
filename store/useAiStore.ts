import { create } from "zustand";
import { apiCall } from "./crmApi";
import { refreshAfterActions } from "./aiRefresh";

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
export interface AiNav { link: string; label: string }
// voice — сообщение родилось из голосовой команды: его озвучивает голосовое управление (а не кнопка «Слушать» в чате)
export interface AiMessage { id: string; role: "user" | "assistant"; text: string; steps?: string[]; actions?: AiAction[]; error?: boolean; voice?: boolean; nav?: AiNav }
export interface AiDownload { kind: "invoices" | "quotes" | "orders" | "contracts" | "purchases"; id: string; number: string; mode: "download" | "open" }
interface JobItem { index: number; task: string; reply: string; steps: string[]; actions: Omit<AiAction, "state">[]; executed?: AiAction[]; error?: boolean; nav?: AiNav; download?: AiDownload; scroll?: { dir: string; pages: number }; find?: { text: string } }
export interface AiStatus {
	configured: boolean;
	// stt — серверная диктовка (ключ OpenAI); браузерная не нуждается ни в ключе, ни в сервере
	stt: boolean;
	// tts — серверная озвучка естественным голосом (lib/ai/tts.ts); недоступна — читает синтез речи браузера
	tts?: boolean;
	limit: number; remaining: number; canWrite: boolean; tools: { name: string; write: boolean }[];
}

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
	send: (text: string, ctx: { locale: string; page: string; voice?: boolean; auto?: boolean }) => Promise<void>;
	confirm: (messageId: string, actionId: string, args?: Record<string, unknown>) => Promise<void>;
	cancel: (messageId: string, actionId: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const localNow = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

// Ассистент Firmspace AI. Сообщения живут только в памяти вкладки: история разговора не сохраняется ни на сервере, ни в браузере.
export const useAiStore = create<AiStore>()((set, get) => {
	const patchAction = (mid: string, aid: string, patch: Partial<AiAction>) =>
		set((s) => ({ messages: s.messages.map((m) => (m.id === mid ? { ...m, actions: m.actions?.map((a) => (a.id === aid ? { ...a, ...patch } : a)) } : m)) }));
	// Ход очереди задач: раз в пару секунд забираем готовые результаты и показываем их по одному; по окончании — итог (его озвучивает голос)
	const pollJob = async (id: string, ctx: { locale: string; page: string; voice?: boolean; auto?: boolean }) => {
		set({ busy: true });
		let next = 0, fails = 0;
		for (let i = 0; i < 900; i++) { // до ~30 минут
			await new Promise((r) => setTimeout(r, i === 0 ? 1200 : 2000));
			const res = await apiCall<{ status: string; total: number; next: number; summary: string; results: (JobItem)[] }>(`/api/ai/jobs/${id}?after=${next}`);
			if (!res.ok || !res.data) { if (++fails >= 5) break; continue; }
			fails = 0;
			const d = res.data;
			for (const r of d.results) {
				const last = r.index === d.total - 1;
				const text = `${r.index + 1}/${d.total} — ${r.reply}`;
				set((s) => ({ messages: [...s.messages, { id: uid(), role: "assistant", text, steps: Array.from(new Set(r.steps)), actions: [...(r.executed ?? []), ...r.actions.map((a) => ({ ...a, state: "pending" as const }))] as AiAction[], error: r.error, nav: r.nav }] }));
				refreshAfterActions((r.executed ?? []).filter((a) => a.state === "done"));
				if (typeof window !== "undefined") {
					if (r.nav && last) window.dispatchEvent(new CustomEvent("iris:go", { detail: r.nav })); // страницу открываем только для последней задачи, чтобы экран не прыгал
					if (r.download) window.dispatchEvent(new CustomEvent("iris:download", { detail: r.download }));
					if (r.scroll) window.dispatchEvent(new CustomEvent("iris:scroll", { detail: r.scroll }));
					if (r.find) window.dispatchEvent(new CustomEvent("iris:find", { detail: r.find }));
				}
			}
			next = d.next;
			if (d.status === "done") {
				if (d.summary) set((s) => ({ messages: [...s.messages, { id: uid(), role: "assistant", text: d.summary, voice: ctx.voice }] }));
				break;
			}
		}
		set({ busy: false });
		get().loadStatus();
	};

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
			const res = await apiCall<{ reply: string; steps: string[]; actions: Omit<AiAction, "state">[]; nav?: AiNav; download?: AiDownload; scroll?: { dir: string; pages: number }; find?: { text: string }; job?: { id: string; total: number }; executed?: (Omit<AiAction, "state"> & { state: "done" | "failed" })[] }>("/api/ai/chat", "POST", { messages: history, locale: ctx.locale, page: ctx.page, now: localNow(), voice: ctx.voice === true, auto: ctx.auto === true });
			if (!res.ok || !res.data) {
				set((s) => ({ busy: false, messages: [...s.messages, { id: uid(), role: "assistant", text: res.message, error: true, voice: ctx.voice }] }));
			} else {
				const d = res.data;
				set((s) => ({ busy: false, messages: [...s.messages, { id: uid(), role: "assistant", text: d.reply, steps: Array.from(new Set(d.steps)), actions: [...(d.executed ?? []), ...d.actions.map((a) => ({ ...a, state: "pending" as const }))], voice: ctx.voice, nav: d.nav }] }));
				// Длинное сообщение с несколькими поручениями: они выполняются в фоне по очереди, результаты приходят по мере готовности
				if (d.job) void pollJob(d.job.id, ctx);
				// Действия, выполненные сразу (режим «без подтверждения»): обновить открытые страницы
				refreshAfterActions((d.executed ?? []).filter((a) => a.state === "done"));
				// Ассистент открыл страницу — её открывает AiAssistant (он знает язык и текущий адрес)
				if (d.nav && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("iris:go", { detail: d.nav }));
				if (d.scroll && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("iris:scroll", { detail: d.scroll }));
				if (d.find && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("iris:find", { detail: d.find }));
				if (d.download && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("iris:download", { detail: d.download }));
			}
			get().loadStatus();
		},
		confirm: async (mid, aid, args) => {
			const action = get().messages.find((m) => m.id === mid)?.actions?.find((a) => a.id === aid);
			if (!action || action.state === "running" || action.state === "done") return;
			patchAction(mid, aid, { state: "running" });
			const res = await apiCall<{ params: Record<string, string>; link: string }>("/api/ai/actions", "POST", { tool: action.tool, args: args ?? action.args });
			if (res.ok && res.data) { patchAction(mid, aid, { state: "done", params: res.data.params, link: res.data.link }); refreshAfterActions([{ tool: action.tool, args: action.args }]); }
			else patchAction(mid, aid, { state: "failed", message: res.message });
		},
		cancel: (mid, aid) => patchAction(mid, aid, { state: "cancelled" }),
	};
});
