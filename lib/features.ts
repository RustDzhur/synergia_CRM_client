// Разделы фирмы по тарифу. Набор разделов тарифа (app/config/plans.ts) проверяется на сервере при каждом запросе
// (lib/auth.ts) и определяет, что видно и что вообще открывается. Администратор платформы может выдать отдельные
// разделы сверх тарифа — Organization.featureOverrides главнее тарифа (тумблеры в админ-кабинете).
// Файл намеренно не тянет ни базу, ни биллинг: те же функции нужны в браузере (меню и страницы).
import { FEATURE_KEYS, planFor, type FeatureKey, type PlanId } from "@/app/config/plans";

export type FeatureOverrides = Partial<Record<FeatureKey, boolean>>;

export interface FeatureOrg {
    plan?: string;
    planOverride?: string;
    planOverrideUntil?: Date | string | null;
    featureOverrides?: unknown;
}

// Тариф фирмы: ручное назначение из админ-кабинета (пока не истекло) главнее подписки
export function orgPlan(org: FeatureOrg): PlanId {
    const until = org.planOverrideUntil ? new Date(org.planOverrideUntil).getTime() : 0;
    if (org.planOverride && (!until || until > Date.now())) return org.planOverride as PlanId;
    return (org.plan as PlanId) || "free";
}

// Что фирме доступно: набор тарифа, поверх — ручные переключатели администратора платформы
export function orgFeatures(org: FeatureOrg): Record<FeatureKey, boolean> {
    const plan = planFor(orgPlan(org));
    const overrides = (org.featureOverrides ?? {}) as Record<string, unknown>;
    return FEATURE_KEYS.reduce((acc, key) => {
        acc[key] = typeof overrides[key] === "boolean" ? (overrides[key] as boolean) : plan.features[key];
        return acc;
    }, {} as Record<FeatureKey, boolean>);
}

// Только включённые разделы — то, что уходит в браузер вместе с данными фирмы
export const enabledFeatures = (org: FeatureOrg): FeatureKey[] => FEATURE_KEYS.filter((key) => orgFeatures(org)[key]);

// Раздел, который защищает адрес API. null — адрес доступен всем участникам фирмы.
export function featureForApi(pathname: string): FeatureKey | null {
    const p = pathname.replace(/^\/api\//, "");
    const first = p.split("/")[0];
    switch (first) {
        case "deals": case "stages": case "contacts": case "companies": return "crm";
        case "tasks": return "tasks";
        case "employees": return "company";
        case "feed": case "events": return "collab";
        case "conversations": case "twilio": case "calls": case "sip": return "channels";
        case "documents": case "drive": return "documents";
        case "mail": return "mail";
        case "marketing": return "marketing";
        case "ads": return "ads";
        case "products": case "orders": case "invoices": case "expenses": case "finance": case "quotes": case "contracts": return "inventory";
        case "automation": return "automation";
        case "ai": return "aiAssistant";
        case "orgs": return p.startsWith("orgs/members") || p.startsWith("orgs/invitations") ? "multiFirm" : null;
        // integrations намеренно без раздела: список подключений нужен звонилке и настройкам независимо от тарифа
        default: return null;
    }
}

// Раздел, который защищает страница CRM (`path` — без префикса языка). null — страница доступна всем.
export function featureForPage(path: string): FeatureKey | null {
    if (path.startsWith("/crm/collaboration/feed") || path.startsWith("/crm/collaboration/calendar")) return "collab";
    if (path.startsWith("/crm/collaboration/chat-and-calls")) return "channels";
    if (path.startsWith("/crm/collaboration/online-documents")) return "documents";
    if (path.startsWith("/crm/collaboration/web-mails")) return "mail";
    if (path.startsWith("/crm/settings/team") || path.startsWith("/crm/settings/colleagues")) return "multiFirm";
    const section = path.split("/")[2] ?? "";
    switch (section) {
        case "crm": return "crm";
        case "tasks": return "tasks";
        case "company": return "company";
        case "inventory": return "inventory";
        case "marketing": return "marketing";
        case "automation": return "automation";
        default: return null; // дашборд, настройки, оплата, админ-кабинет
    }
}
