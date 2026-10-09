// Роли и доступ к разделам CRM. Раздел определяется по адресу запроса; проверка — в requireUser (lib/auth.ts).
// advisor (бухгалтер) и counsel (юрист) — роли специалистов практики в фирме клиента (lib/practice): существуют только вместе
// с действующей связью ClientLink, не назначаются через «Команду» и никогда не получают оплату, состав фирмы, настройки и автоматизацию.
export type Role = "owner" | "admin" | "manager" | "employee" | "viewer" | "advisor" | "counsel";
export type Module = "crm" | "tasks" | "company" | "collab" | "mail" | "marketing" | "inventory" | "automation" | "settings" | "billing" | "members";

export const ROLES: Role[] = ["owner", "admin", "manager", "employee", "viewer", "advisor", "counsel"];
export const PRACTICE_ROLES: Role[] = ["advisor", "counsel"];
export const isPracticeRole = (r: unknown): r is "advisor" | "counsel" => r === "advisor" || r === "counsel";
/** Разделы, которые клиент может открыть специалисту практики. Оплата, состав фирмы, настройки, автоматизация, маркетинг и почта — никогда. */
export const PRACTICE_GRANTABLE: Module[] = ["inventory", "crm", "tasks", "collab"];

// Тонкие права специалиста практики внутри выданных разделов. Хранятся в том же списке modules связи с префиксом «p:».
// Нет ни одного «p:» — прежнее поведение (раздел целиком). Есть хотя бы один — открыто только перечисленное (lib/practice/gate.ts).
export const PERM_PREFIX = "p:";
export const PRACTICE_PERMS = [
    { id: "invoices", module: "inventory" }, { id: "expenses", module: "inventory" }, { id: "bank", module: "inventory" },
    { id: "stock", module: "inventory" }, { id: "reports", module: "inventory" }, { id: "contracts", module: "inventory" },
    { id: "export", module: "inventory" }, { id: "import", module: "inventory" },
    { id: "clients", module: "crm" }, { id: "deals", module: "crm" },
] as const;
export type PracticePerm = (typeof PRACTICE_PERMS)[number]["id"];
export const isPerm = (v: unknown): v is string => typeof v === "string" && v.startsWith(PERM_PREFIX) && PRACTICE_PERMS.some((p) => PERM_PREFIX + p.id === v);
export const permsOf = (modules: string[]): PracticePerm[] => modules.filter(isPerm).map((m) => m.slice(PERM_PREFIX.length) as PracticePerm);

/** Какое тонкое право нужно для адреса. null — отдельного права нет (хватает раздела). */
export function permForPath(pathname: string): PracticePerm | null {
    const p = pathname.replace(/^\/api\//, "");
    const [first, second] = p.split("/");
    switch (first) {
        case "invoices": case "quotes": case "orders": case "recurring-invoices": return "invoices";
        case "expenses": case "suppliers": case "supplier-invoices": case "purchases": return "expenses";
        case "bank": case "reconciliation": return "bank";
        case "products": case "stock": case "stock-docs": case "warehouses": case "boms": case "production": case "production-orders": case "pos": case "novaposhta": case "ukrposhta": case "marketplace": return "stock";
        case "contracts": case "contract-templates": case "legal": return "contracts";
        case "export": return "export";
        case "import": return "import";
        case "contacts": case "companies": return "clients";
        case "deals": case "stages": return "deals";
        case "finance": return second === "settings" ? null : "reports";
        case "review": case "assets": case "issued-docs": return "reports";
        default: return null;
    }
}

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
    advisor: ["inventory", "crm", "tasks", "collab"],
    counsel: ["inventory", "crm", "tasks", "collab"],
};

// Адреса API, которые не относятся к данным фирмы или проверяют доступ сами (публичные хуки, вход, кабинет владельца
// платформы, собственные проверки в маршруте). Для них requireUser не требует раздела.
// Любой первый сегмент адреса, которого нет ни здесь, ни в moduleForPath, закрыт целиком («запрещено по умолчанию»):
// новый маршрут нельзя «забыть» — пока для него не выбран раздел, им никто не пользуется (см. tests/access.test.ts).
export const OPEN_API_SEGMENTS = [
    "auth", "health", "client-error", "errors", "contact", "cron", "hooks", "webhooks", "webchat", "media", "public", "promo",
    "blog", "agent", "agents", "admin", "ai", "iris-bot", "lookup", "records", "notifications", "people", "demo", "internal",
    "currency", // курсы валют для цен лендинга: публичные данные, авторизация не нужна
] as const;

// Разделы, которые открывает выгрузка/загрузка файла: зависят от вида данных (export?kind=…, import: kind в теле)
export const EXPORT_MODULE: Record<string, Module> = {
    contacts: "crm", companies: "crm",
    products: "inventory", invoices: "inventory", orders: "inventory", quotes: "inventory", expenses: "inventory", datev: "inventory",
};
export const IMPORT_MODULE: Record<string, Module> = { contacts: "crm", companies: "crm", products: "inventory", boms: "inventory", stock: "inventory" };

// Какой раздел защищает адрес. null — доступен любому участнику фирмы (или не относится к данным фирмы).
// "deny" — адрес неизвестен, закрыт для всех: так новый маршрут не открывается случайно.
export function moduleForPath(pathname: string, method: string, search?: URLSearchParams): Module | null | "deny" {
    const p = pathname.replace(/^\/api\//, "");
    const first = p.split("/")[0];
    switch (first) {
        case "deals": case "stages": case "contacts": case "companies": return "crm";
        case "tasks": case "projects": return "tasks";
        case "employees": return "company";
        case "feed": case "events": case "conversations": case "twilio": case "calls": case "sip": case "documents": case "drive": return "collab";
        case "calendar": case "messages": case "onedrive": return "collab";
        case "mail": return "mail";
        case "marketing": case "ads": return "marketing";
        // раздел переименован из «Inventory Management» в «Finance» (склад остался его частью) — модуль в правах тот же
        case "products": case "orders": case "invoices": case "expenses": case "finance": case "quotes": case "contracts": return "inventory";
        // остальная бухгалтерия: банк, склад, закупки, производство, касса, доставка, основные средства, выгрузки документов
        case "bank": case "boms": case "pos": case "production": case "production-orders": case "purchases": case "reconciliation":
        case "recurring-invoices": case "stock": case "stock-docs": case "supplier-invoices": case "suppliers": case "warehouses":
        case "issued-docs": case "assets": case "novaposhta": case "ukrposhta": case "marketplace": return "inventory";
        case "review": return "inventory"; // проверка документов, закрытие периода и запросы клиенту — раздел «Финансы»
        case "export": return EXPORT_MODULE[search?.get("kind") ?? ""] ?? "inventory";
        case "import": return "crm"; // вид данных приходит в теле запроса: маршруты import/* дополнительно проверяют IMPORT_MODULE
        case "billing": return "billing";
        case "automation": case "office": return "automation"; // Робот-офис живёт в разделе «Автоматизация»
        case "connect": return "settings"; // ключи и MCP-доступ к данным фирмы
        case "env": return "settings"; // переменные окружения фирмы: смотреть и менять — владелец и администраторы
        case "notify-settings": return method === "GET" ? null : "settings"; // бот фирмы: смотреть можно всем, менять — по правам
        case "integrations": case "messenger": case "whatsapp": return method === "GET" ? "collab" : "settings"; // список каналов нужен звонилке всем; менять — только с доступом к настройкам
        case "legal": return "crm"; // хранилище договоров клиента (юрист): раздел «Клиенты»
        // шаблоны договоров с полями-меточками: читать может любой участник фирмы (нужно при выписке договора
        // в бухгалтерии), а создавать и менять — только с доступом к разделу «Клиенты», где они и настраиваются
        case "contract-templates": return method === "GET" ? null : "crm";
        case "partner": case "bank-offers": case "bank-partner": return null; // страница банка, заявки клиента и кабинет банка: каждый маршрут проверяет права сам (lib/partner)
        case "practice": return null; // кабинет практики и согласия клиента: каждый маршрут проверяет права сам (lib/practice)
        case "orgs": return p.startsWith("orgs/members") || p.startsWith("orgs/invitations") ? "members" : null;
        default: return (OPEN_API_SEGMENTS as readonly string[]).includes(first) ? null : "deny";
    }
}

export function effectiveModules(role: Role, custom: string[]): Module[] {
    if (isPracticeRole(role)) {
        // доступ специалиста: то, что клиент выдал в связи, но не шире PRACTICE_GRANTABLE
        const given = custom.length ? custom : ROLE_MODULES[role];
        return given.filter((m): m is Module => (PRACTICE_GRANTABLE as string[]).includes(m));
    }
    if (role === "owner" || role === "admin" || !custom.length) return ROLE_MODULES[role];
    return custom.filter((m): m is Module => (GRANTABLE as string[]).includes(m));
}

export const canAccess = (role: Role, custom: string[], module: Module | null | "deny", method: string) => {
    if (module === "deny") return false;
    if (role === "viewer" && !["GET", "HEAD"].includes(method)) return false; // наблюдатель только читает
    return module === null || effectiveModules(role, custom).includes(module);
};

// Можно ли пользователю загружать файл этого вида данных (раздел зависит от вида, а не от адреса)
export const canImportKind = (user: { role: Role; modules: string[] }, kind: string) => {
    const section = IMPORT_MODULE[kind];
    return !!section && canAccess(user.role, user.modules, section, "POST");
};
