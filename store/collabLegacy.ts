import { eventDay, eventMinutes, eventText, eventTime } from "@/lib/events";
import { api } from "./crmApi";

// Перенос старых событий календаря на сервер. До появления /api/events события лежали в localStorage
// (ключ "crm-collab"): отправляем их один раз и убираем из хранилища. Старый локальный id уходит как
// externalId — если перенос оборвётся (закрыли вкладку, пропала сеть), повторная отправка не создаст дубль.
// Отдельным модулем, потому что это чистая логика над localStorage, не зависящая от состояния хранилища.
// Значения проверяются теми же правилами, что и в /api/events (lib/events.ts), — расхождения быть не должно.

export const LEGACY_KEY = "crm-collab";

export interface LegacyEvent {
	title: string;
	description: string;
	color: string;
	calendar: "my" | "company";
	date: string;
	startTime: string;
	endDate: string;
	endTime: string;
	attendees: string;
	location: string;
	reminder: number;
	source: "local";
	externalId: string;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// События из сохранённого состояния; всё лишнее приводим к тем же значениям, что проверяет /api/events
export function readLegacyEvents(): LegacyEvent[] {
	try {
		const list = (JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null") as { state?: { events?: unknown } } | null)?.state?.events;
		if (!Array.isArray(list)) return [];
		return list.flatMap((item) => {
			const e = (item ?? {}) as Record<string, unknown>;
			const title = eventText(e.title, 200);
			const date = eventDay(e.date);
			const id = eventText(e.id, 100);
			if (!title || !date || !id) return []; // без названия, даты или id переносить нечего
			const startTime = eventTime(e.startTime, "09:00");
			return [{
				title,
				description: eventText(e.description, 2000),
				color: eventText(e.color, 20),
				calendar: e.calendar === "company" ? "company" as const : "my" as const,
				date,
				startTime,
				endDate: eventDay(e.endDate, date),
				endTime: eventTime(e.endTime, startTime),
				attendees: eventText(e.attendees, 200),
				location: eventText(e.location, 200),
				reminder: eventMinutes(e.reminder),
				source: "local" as const,
				externalId: id,
			}];
		});
	} catch {
		return []; // приватный режим или мусор в хранилище
	}
}

// Убирает события из сохранённого состояния: в localStorage остаются только документы
export function stripLegacyEvents() {
	try {
		const raw = localStorage.getItem(LEGACY_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
		if (!parsed?.state || !("events" in parsed.state)) return;
		delete parsed.state.events;
		localStorage.setItem(LEGACY_KEY, JSON.stringify(parsed));
	} catch { /* приватный режим */ }
}

let pending: LegacyEvent[] | null = null; // null — из localStorage ещё не читали
let migration: Promise<void> | null = null;

// Читает события из localStorage один раз за сессию страницы (вызывается до rehydrate хранилища)
export function loadLegacyEvents() {
	if (pending === null) pending = readLegacyEvents();
}

// Отправляет события на сервер. Ошибка сети не теряет данные: непереданное остаётся и уйдёт при следующем
// заходе. Повторные вызовы, пока перенос идёт, ничего не делают.
export function migrateLegacyEvents(): Promise<void> {
	if (migration) return migration;
	if (!pending?.length) return Promise.resolve();
	migration = (async () => {
		const results = await Promise.all(pending!.map((e) => api<unknown>("/api/events", "POST", e)));
		pending = pending!.filter((_, i) => !results[i]);
		if (pending.length) migration = null; // сеть подвела: пробуем при следующем заходе
		else stripLegacyEvents();
	})();
	return migration;
}
