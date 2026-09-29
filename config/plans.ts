// Тарифы Firmspace CRM — один источник правды для лендинга (блок Choose Your Plan), раздела CRM «Upgrade Your Plan»
// и серверных проверок (lib/features.ts, lib/access.ts, /api/records, lib/ai/run.ts, /api/documents/upload, /api/orgs/members).
// Тарифы отличаются тремя вещами: цена, лимиты (люди, правила автоматизации, обращения к ИИ, хранилище) и набор
// разделов. Набор разделов — не украшение карточки: он проверяется на сервере (lib/features.ts), поэтому неоплаченный
// раздел не открыть ни запросом, ни по прямой ссылке. Администратор платформы может выдать фирме отдельные разделы
// сверх тарифа — тумблерами в админ-кабинете (см. Organization.featureOverrides).
export type PlanId = "free" | "standard" | "professional";
export type FeatureKey =
	| "crm" // сделки, контакты, компании — воронка продаж
	| "tasks" // Tasks and Projects
	| "company" // Company: сотрудники и справочник фирмы
	| "collab" // Feed и Calendar
	| "documents" // Online Documents: документы и папки фирмы
	| "channels" // Chat and Calls: Telegram, Viber, Messenger, веб-чат, SIP/Twilio-звонки
	| "mail" // Web Mails: почта, автосоздание лидов из писем
	| "inventory" // Finance: счета, расходы, склад, предложения, договоры
	| "automation" // конструктор правил автоматизации (без автономного ИИ-шага — см. aiAutomation)
	| "aiAssistant" // Firmspace AI: чат, сводки, чтение PDF, разбор писем и документов
	| "marketing" // Marketing: кампании, сегменты, шаблоны, Sales Boost
	| "multiFirm" // несколько фирм на одном аккаунте, приглашение сотрудников с ролями
	| "ads" // Ad performance: подключение Google Ads / Meta Ads и статистика по рекламе
	| "aiAutomation"; // «AI decides and acts» — автономный шаг автоматизации без подтверждения

export const FEATURE_KEYS: FeatureKey[] = [
	"crm", "tasks", "company", "collab", "documents", "channels", "mail", "inventory",
	"automation", "aiAssistant", "marketing", "multiFirm", "ads", "aiAutomation",
];

export interface PlanDef {
	id: PlanId;
	priceMonth: number; // € в месяц; 0 — бесплатно
	users: number | null; // участников фирмы; null — без ограничений (лимит проверяет POST /api/orgs/members)
	automationRules: number; // правил автоматизации на фирму (POST /api/records проверяет для key "automation:rules")
	aiDailyRequests: number; // разговоров с Firmspace AI в сутки на фирму — общий счётчик для чата и авто-шага (lib/ai/run.ts)
	storageMb: number; // файлы и фото в Documents, суммарно на фирму (lib/documents.ts quotaBytes)
	features: Record<FeatureKey, boolean>;
	highlighted?: boolean; // тёмная карточка на лендинге
}

// Год = 10 месяцев (два месяца в подарок)
export const YEAR_MONTHS = 10;

// Набор разделов тарифа: перечислены включённые, остальные выключены
const withFeatures = (on: FeatureKey[]): Record<FeatureKey, boolean> =>
	FEATURE_KEYS.reduce((acc, key) => ({ ...acc, [key]: on.includes(key) }), {} as Record<FeatureKey, boolean>);

export const PLANS: PlanDef[] = [
	{
		// Free — минимум для одного человека: воронка продаж и задачи
		id: "free",
		priceMonth: 0,
		users: 1,
		automationRules: 0,
		aiDailyRequests: 0,
		storageMb: 500,
		features: withFeatures(["crm", "tasks"]),
	},
	{
		// Company — для небольшой команды: добавляются сотрудники, лента и календарь
		id: "standard",
		priceMonth: 20,
		users: 50,
		automationRules: 30,
		aiDailyRequests: 100,
		storageMb: 2000,
		features: withFeatures(["crm", "tasks", "company", "collab", "multiFirm"]),
		highlighted: true,
	},
	{
		// Everything — вся платформа без ограничений по людям
		id: "professional",
		priceMonth: 53,
		users: null,
		automationRules: 200,
		aiDailyRequests: 300,
		storageMb: 10000,
		features: withFeatures(FEATURE_KEYS),
	},
];

export const planFor = (id: string): PlanDef => PLANS.find((p) => p.id === id) ?? PLANS[0];

// Лимиты, которые у тарифа реально достижимы: правила и ИИ — только если в тарифе есть автоматизация и ИИ, хранилище — если есть Documents.
// Иначе строка обещала бы «30 правил» там, где раздел автоматизации закрыт.
export function limitParts(plan: PlanDef): { rules?: number; ai?: number; storage?: string } {
	const f = plan.features;
	return {
		rules: f.automation ? plan.automationRules : undefined,
		ai: f.aiAssistant ? plan.aiDailyRequests : undefined,
		storage: f.documents ? (plan.storageMb >= 1000 ? `${plan.storageMb / 1000} GB` : `${plan.storageMb} MB`) : undefined,
	};
}

type Translate = (key: string, values?: Record<string, string | number>) => string;
export function limitsLine(plan: PlanDef, t: Translate): string {
	const p = limitParts(plan);
	const out: string[] = [];
	if (p.rules !== undefined) out.push(t("limitRules", { count: p.rules }));
	if (p.ai !== undefined) out.push(t("limitAi", { count: p.ai }));
	if (p.storage !== undefined) out.push(t("limitStorage", { size: p.storage }));
	return out.join(" · ");
}
