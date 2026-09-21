import type { Notif } from "@/app/store/useNotificationStore";

// Текст уведомления на языке интерфейса: t — useTranslations("notif")
type T = (key: string, values?: Record<string, string | number>) => string;

export function notifText(t: T, n: Notif) {
	const p = n.params;
	switch (n.type) {
		case "mail": return t("mail", { from: String(p.from ?? ""), subject: String(p.subject ?? "") });
		case "mail_many": return t("mailMany", { count: Number(p.count ?? 0) });
		case "lead": return t("lead", { name: String(p.name ?? ""), subject: String(p.subject ?? "") });
		case "message": return t("message", { name: String(p.name ?? ""), text: String(p.text ?? "") });
		case "missed_call": return t("missedCall", { name: String(p.name ?? "") });
		case "deadline": return t(`deadline_${p.stage}`, { title: String(p.title ?? ""), kind: t(`kind_${p.kind}`) });
		case "automation": return String(p.text ?? "");
		case "team": return t("team", { name: String(p.name ?? ""), text: String(p.text ?? "") });
		default: return t("generic");
	}
}
