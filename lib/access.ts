// Роли и доступ к разделам CRM. Раздел определяется по адресу запроса; проверка — в requireUser (lib/auth.ts).
export type Role = "owner" | "admin" | "manager" | "employee" | "viewer";
export type Module = "crm" | "tasks" | "company" | "collab" | "mail" | "marketing" | "inventory" | "automation" | "settings" | "billing" | "members";

export const ROLES: Role[] = ["owner", "admin", "manager", "employee", "viewer"];
export const ASSIGNABLE_ROLES: Role[] = ["admin", "manager", "employee", "viewer"]; // владельцем можно только быть, не назначить
export const MODULES: Module[] = ["crm", "tasks", "company", "collab", "mail", "marketing", "inventory", "automation", "settings", "billing", "members"];
// Разделы, которые можно выдавать сотруднику выборочно (оплата и состав фирмы — только владельцу и администратору по роли)
export const GRANTABLE: Module[] = ["crm", "tasks", "company", "collab", "mail", "marketing", "inventory", "automation"];

// Метка «ни одного раздела»: пустой список означает «права роли по умолчанию», поэтому явный запрет хранится так
export const NO_MODULES = "none";

const ALL_BUT_BILLING = MODULES.filter((m) => m !== "billing");
export const ROLE_MODULES: Record<Role, Module[]> = {
    owner: MODULES,
    admin: ALL_BUT_BILLING,
    manager: ["crm", "tasks", "company", "collab", "mail", "marketing", "inventory"],
    employee: ["crm", "tasks", "collab", "mail"],
    viewer: ["crm", "tasks", "collab", "mail"],
};

// Какой раздел защищает адрес. null — доступен любому участнику фирмы (или не относится к данным фирмы).
export function moduleForPath(pathname: string, method: string): Module | null {
    const p = pathname.replace(/^\/api\//, "");
    const first = p.split("/")[0];
    switch (first) {
        case "deals": case "stages": case "contacts": case "companies": return "crm";
        case "tasks": return "tasks";
        case "employees": return "company";
        case "feed": case "events": case "conversations": case "twilio": case "calls": case "sip": case "documents": case "drive": return "collab";
        case "mail": return "mail";
        case "marketing": case "ads": return "marketing";
        // раздел переименован из «Inventory Management» в «Finance» (склад остался его частью) — модуль в правах тот же
        case "products": case "orders": case "invoices": case "expenses": case "finance": case "quotes": case "contracts": return "inventory";
        case "automation": case "office": return "automation"; // Робот-офис живёт в разделе «Автоматизация»
        case "billing": return "billing";
        case "notifications": return null; // свои уведомления видит любой участник
        case "env": return "settings"; // переменные окружения фирмы: смотреть и менять — владелец и администраторы
        case "notify-settings": return method === "GET" ? null : "settings"; // бот фирмы: смотреть можно всем, менять — по правам
        case "integrations": return method === "GET" ? "collab" : "settings"; // список каналов нужен звонилке всем; менять — только с доступом к настройкам
        case "orgs": return p.startsWith("orgs/members") || p.startsWith("orgs/invitations") ? "members" : null;
        default: return null;
    }
}

export function effectiveModules(role: Role, custom: string[]): Module[] {
    if (role === "owner" || role === "admin" || !custom.length) return ROLE_MODULES[role];
    return custom.filter((m): m is Module => (GRANTABLE as string[]).includes(m));
}

export const canAccess = (role: Role, custom: string[], module: Module | null, method: string) => {
    if (role === "viewer" && !["GET", "HEAD"].includes(method)) return false; // наблюдатель только читает
    return module === null || effectiveModules(role, custom).includes(module);
};
