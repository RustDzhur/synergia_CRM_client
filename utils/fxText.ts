// Перевод записей, которые сервер хранит как «@@ключ|{параметры}» (lib/sync/texts.ts). Обычный текст (заметки людей,
// старые записи) возвращается как есть.
type T = (key: string, params?: Record<string, string | number>) => string;

export function localizeFx(t: T, text: string): string {
	if (!text.startsWith("@@")) return text;
	const bar = text.indexOf("|");
	const key = text.slice(2, bar < 0 ? undefined : bar);
	let params: Record<string, string | number> = {};
	try { if (bar >= 0) params = JSON.parse(text.slice(bar + 1)); } catch { /* повреждённые параметры — подставятся пустые */ }
	try { return t(key, params); } catch { return key; }
}
