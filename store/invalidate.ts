// Единая «шина» обновления данных между разделами. Хранилища (CRM, контакты, фирмы, задачи, финансы) независимы, и раньше
// они обновляли друг друга только после действий ассистента (store/aiRefresh.ts): оплатил счёт в «Финансах» — вкладка
// «CRM» показывала старую сделку до перезагрузки страницы. Теперь любая успешная запись (POST/PATCH/DELETE) через
// store/crmApi.ts сообщает сюда, какие данные она могла затронуть, а хранилища, загруженные в этой вкладке, перечитываются.
// Хранилище подключается одной строкой registerRefresher() рядом с собой; не загруженное в этой вкладке — не перечитывается.

export type Entity = "deals" | "contacts" | "companies" | "tasks" | "finance";

const refreshers: Record<Entity, Array<() => unknown>> = { deals: [], contacts: [], companies: [], tasks: [], finance: [] };

export function registerRefresher(entity: Entity, fn: () => unknown) {
    refreshers[entity].push(fn);
}

// Какие данные затрагивает запись по адресу API, кроме самих данных этого адреса (их хранилище обновляет само).
const CLIENTS: Entity[] = ["deals", "contacts", "companies"];
const AFFECTS: Record<string, Entity[]> = {
    deals: ["contacts", "companies"], // этап и выигрыш пишутся в ленты клиента
    stages: ["deals"],
    contacts: ["deals", "companies", "finance"], // имя клиента разошлось по сделкам и черновикам документов
    companies: ["deals", "contacts", "finance"],
    tasks: CLIENTS, // выполнение задачи пишется в ленты сделки и клиента
    projects: ["tasks"],
    invoices: CLIENTS, // оплата и отправка пишутся в ленты и могут выиграть сделку
    orders: CLIENTS,
    quotes: [...CLIENTS],
    contracts: [...CLIENTS],
    expenses: ["deals", "finance"],
    bank: [...CLIENTS, "finance"],
    "recurring-invoices": ["finance"],
};
const FINANCE_PREFIXES = ["products", "stock", "stock-docs", "suppliers", "purchases", "supplier-invoices", "warehouses", "pos", "production", "production-orders", "boms", "assets", "import", "finance", "issued-docs", "reconciliation"];
const IGNORED = ["notifications", "ai", "auth", "client-error", "errors", "env", "notify-settings", "iris-bot", "feed", "documents", "drive", "mail", "calls", "twilio", "sip"];

export function affectedBy(url: string, method: string): Entity[] {
    if (method === "GET") return [];
    const path = url.split("?")[0].replace(/^\/api\//, "");
    const first = path.split("/")[0];
    if (IGNORED.includes(first)) return [];
    if (FINANCE_PREFIXES.includes(first)) return first === "import" ? [...CLIENTS, "finance"] : ["finance"];
    // правка записи ленты клиента (…/activities) — не затрагивает другие разделы
    if (path.includes("/activities")) return [];
    return AFFECTS[first] ?? [];
}

let ownMutationAt = 0;
// Когда эта вкладка последний раз записывала данные: опрос ревизии (useNotificationStore) не дублирует обновление сразу после неё
export const lastOwnMutationAt = () => ownMutationAt;

const pending = new Set<Entity>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
    timer = null;
    const entities = Array.from(pending);
    pending.clear();
    for (const entity of entities) {
        for (const fn of refreshers[entity]) {
            try { void Promise.resolve(fn()).catch(() => undefined); } catch { /* обновление — удобство, на данные не влияет */ }
        }
    }
    if (typeof window !== "undefined" && entities.length) window.dispatchEvent(new CustomEvent("crm:changed", { detail: { entities } }));
}

// Пачкой: серия запросов подряд (удаление нескольких записей, сохранение формы) даёт одно обновление
export function invalidate(...entities: Entity[]) {
    if (!entities.length) return;
    entities.forEach((e) => pending.add(e));
    if (!timer) timer = setTimeout(flush, 350);
}

export function notifyMutation(url: string, method: string) {
    if (method !== "GET") ownMutationAt = Date.now();
    invalidate(...affectedBy(url, method));
}
