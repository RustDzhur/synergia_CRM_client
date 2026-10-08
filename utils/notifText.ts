import { localizeFx } from "@/utils/fxText";
import type { Notif } from "@/store/useNotificationStore";

// Текст уведомления на языке интерфейса: t — useTranslations("notif")
type T = (key: string, values?: Record<string, string | number>) => string;

// tx — переводчик раздела feedText: тексты, которые сервер хранит как «@@ключ|параметры» (lib/sync/texts.ts)
export function notifText(t: T, n: Notif, tx?: (key: string, params?: Record<string, string | number>) => string) {
	const fxText = (v: unknown) => (tx ? localizeFx(tx, String(v ?? "")) : String(v ?? ""));
	const p = n.params;
	switch (n.type) {
		case "mail": return t("mail", { from: String(p.from ?? ""), subject: String(p.subject ?? "") });
		case "mail_many": return t("mailMany", { count: Number(p.count ?? 0) });
		case "lead": return t("lead", { name: String(p.name ?? ""), subject: String(p.subject ?? "") });
		case "message": return t("message", { name: String(p.name ?? ""), text: fxText(p.text) });
		case "missed_call": return t("missedCall", { name: String(p.name ?? "") });
		case "deadline": return t(`deadline_${p.stage}`, { title: String(p.title ?? ""), kind: t(`kind_${p.kind}`) });
		case "event": return t("event", { title: String(p.title ?? ""), at: String(p.at ?? "") });
		case "client_request": return t("clientRequest", { name: String(p.name ?? ""), subject: String(p.subject ?? "") });
		case "request_answered": return t("requestAnswered", { name: String(p.name ?? ""), subject: String(p.subject ?? "") });
		case "automation": return String(p.text ?? "");
		case "team": return t("team", { name: String(p.name ?? ""), text: fxText(p.text) });
		default: return t("generic");
	}
}
