// Тарифы Firmspace CRM — один источник правды для лендинга (блок Choose Your Plan) и раздела CRM «Upgrade Your Plan».
// Три тарифа: бесплатный с ограниченными функциями, 20 €/мес (функций больше) и 35 €/мес (полный доступ). Цены в евро.
export type PlanId = "free" | "standard" | "professional";
export type FeatureKey = "chat" | "calls" | "calendar" | "workspace" | "feed" | "knowledge";

export const FEATURE_KEYS: FeatureKey[] = ["chat", "calls", "calendar", "workspace", "feed", "knowledge"];

export interface PlanDef {
	id: PlanId;
	priceMonth: number; // € в месяц; 0 — бесплатно
	users: number | null; // null — без ограничений
	features: Record<FeatureKey, boolean>;
	highlighted?: boolean; // тёмная карточка на лендинге
}

// Год = 10 месяцев (два месяца в подарок)
export const YEAR_MONTHS = 10;

export const PLANS: PlanDef[] = [
	{
		id: "free",
		priceMonth: 0,
		users: 5,
		features: { chat: true, calls: false, calendar: true, workspace: false, feed: true, knowledge: false },
	},
	{
		id: "standard",
		priceMonth: 20,
		users: 50,
		features: { chat: true, calls: true, calendar: true, workspace: true, feed: true, knowledge: false },
		highlighted: true,
	},
	{
		id: "professional",
		priceMonth: 35,
		users: null,
		features: { chat: true, calls: true, calendar: true, workspace: true, feed: true, knowledge: true },
	},
];
