import { useMessages, useTranslations } from "next-intl";

// Подпись действия, которое предложил или выполнил робот («Створити рахунок: …»). Подписи берём из ai.act_<инструмент>;
// если для инструмента перевода нет — показываем его имя, а не падаем на отсутствующем ключе.
export function useActionLabel() {
	const ta = useTranslations("ai");
	const messages = useMessages() as { ai?: Record<string, unknown> };
	return (a: { tool: string; target?: string }) => {
		const key = `act_${a.tool}`;
		const base = typeof messages.ai?.[key] === "string" ? ta(key) : a.tool.replace(/_/g, " ");
		return a.target ? `${base}: ${a.target}` : base;
	};
}
