// Тарифы Firmspace CRM — один источник правды для лендинга (блок Choose Your Plan), раздела CRM «Upgrade Your Plan»
// и серверных проверок лимитов (lib/access.ts, /api/records, lib/ai/run.ts, /api/documents/upload, /api/orgs/members, /api/ads).
// Все три тарифа дают полный набор разделов CRM (это не урезанная демоверсия) — разница между ними в трёх вещах:
// сколько это стоит, сколько людей/действий умещается в лимиты, и две функции, которые имеет смысл продавать отдельно
// (реальная реклама — Google/Meta Ads — и автономный ИИ-шаг в автоматизации, который действует без подтверждения).
export type PlanId = "free" | "standard" | "professional";
export type FeatureKey =
	| "crm" // сделки, контакты, компании — воронка продаж
	| "tasks" // Tasks and Projects
	| "company" // Company: сотрудники и справочник фирмы
	| "collab" // Feed, Calendar, Online Documents
	| "channels" // Chat and Calls: Telegram, Viber, Messenger, веб-чат, SIP/Twilio-звонки
	| "mail" // Web Mails: почта, автосоздание лидов из писем
	| "automation" // конструктор правил автоматизации (без автономного ИИ-шага — см. aiAutomation)
	| "aiAssistant" // Firmspace AI: чат, сводки, чтение PDF, разбор писем и документов
	| "marketing" // Marketing: кампании, сегменты, шаблоны, Sales Boost
	| "multiFirm" // несколько фирм на одном аккаунте, приглашение сотрудников с ролями
	| "ads" // Ad performance: подключение Google Ads / Meta Ads и статистика по рекламе
	| "aiAutomation"; // «AI decides and acts» — автономный шаг автоматизации без подтверждения

export const FEATURE_KEYS: FeatureKey[] = [
	"crm", "tasks", "company", "collab", "channels", "mail", "automation", "aiAssistant", "marketing", "multiFirm", "ads", "aiAutomation",
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

const BASE: Record<FeatureKey, boolean> = {
	crm: true, tasks: true, company: true, collab: true, channels: true, mail: true,
	automation: true, aiAssistant: true, marketing: true, multiFirm: true,
	ads: false, aiAutomation: false,
};

export const PLANS: PlanDef[] = [
	{
		id: "free",
		priceMonth: 0,
		users: 5,
		automationRules: 5,
		aiDailyRequests: 15,
		storageMb: 500,
		features: { ...BASE },
	},
	{
		id: "standard",
		priceMonth: 20,
		users: 50,
		automationRules: 30,
		aiDailyRequests: 100,
		storageMb: 2000,
		features: { ...BASE, ads: true },
		highlighted: true,
	},
	{
		id: "professional",
		priceMonth: 35,
		users: null,
		automationRules: 200,
		aiDailyRequests: 300,
		storageMb: 10000,
		features: { ...BASE, ads: true, aiAutomation: true },
	},
];

export const planFor = (id: string): PlanDef => PLANS.find((p) => p.id === id) ?? PLANS[0];
