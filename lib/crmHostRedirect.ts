// Хост приложения crm.firmspace.de обслуживает только вход и кабинет: маркетинговые пути
// (/, /features, /about, …) на нём редиректят на страницу входа — маркетинг переезжает на
// firmspace.de (фаза 1 плана 2026-10-23-firmspace-website.md, редирект обратимый).
// Чистая функция для middleware.ts и юнит-тестов (без next/server, чтобы тесты не поднимали Next).

export const CRM_APP_HOST = "crm.firmspace.de";

// Пути приложения: страница входа и сам кабинет (плюс оплата и кабинет клиента по ссылке /c/…).
// Всё остальное на crm.firmspace.de — маркетинг, его не показываем.
const APP_PREFIXES = ["/login", "/crm", "/pay", "/c"];

// Префиксы локалей сайта (совпадают с createMiddleware в middleware.ts)
const LOCALE_RE = /^\/(de|en|ua)(?=\/|$)/;

// host из заголовка: нижний регистр и без порта (для локальных проверок crm.firmspace.de:3210)
export const cleanHost = (host: string) => host.trim().toLowerCase().replace(/:\d+$/, "");

// Куда вести путь на crm.firmspace.de: "/de/login" (или "/login" без префикса локали), либо ""
// для путей приложения и других хостов — тогда запрос идёт как обычно.
export function crmHostRedirect(host: string, pathname: string): string {
    if (cleanHost(host) !== CRM_APP_HOST) return "";
    const m = LOCALE_RE.exec(pathname);
    const rest = (m ? pathname.slice(m[0].length) : pathname) || "/";
    const isApp = APP_PREFIXES.some((p) => rest === p || rest.startsWith(p + "/"));
    if (isApp) return "";
    return `${m ? `/${m[1]}` : ""}/login`;
}
