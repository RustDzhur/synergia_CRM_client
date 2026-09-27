import type { Activity, ActivityType } from "@/app/types/crm";

// Фирма, в рамках которой работает пользователь: сервер по этому заголовку выбирает данные (если фирма не подходит — личная)
export const ORG_KEY = "crm.org";
export const activeOrgId = () => { try { return localStorage.getItem(ORG_KEY) ?? ""; } catch { return ""; } };

export function authHeaders(json = true): Record<string, string> {
    const org = activeOrgId();
    return {
        ...(json ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        ...(org ? { "X-Org-Id": org } : {}),
        // Местный часовой пояс браузера (минуты от UTC): события и сроки хранят местное время без пояса,
        // и сервер по этому заголовку понимает, наступило ли уже время напоминания (lib/calendar/reminders.ts).
        "X-Tz-Offset": String(-new Date().getTimezoneOffset()),
        // Имя того же пояса («Europe/Berlin»). Сдвиг в минутах верен только на сегодня, а событие может
        // стоять на дату с другим сезонным временем — для записи в Google нужен сам пояс (lib/google/calendar.ts).
        "X-Tz-Name": Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    };
}

// Сессия кончилась (токен старше суток или отозван): убираем его и уводим на страницу входа.
// 401 отличается от 403 тем, что 403 — это «вошёл, но прав нет», там уходить некуда.
let leaving = false;
function sessionExpired() {
    if (leaving) return;
    leaving = true;
    try { localStorage.removeItem("token"); } catch { /* приватный режим */ }
    const locale = (window.location.pathname.match(/^\/(de|en|ua)(?=\/|$)/) ?? [])[1] ?? "de";
    window.location.href = `/${locale}`;
}

// Обёртка над fetch: при ошибке (сеть или статус не 2xx) возвращает null, а не бросает исключение.
export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T | null> {
    try {
        const res = await fetch(url, {
            method,
            headers: authHeaders(),
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (res.status === 401) { sessionExpired(); return null; }
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

// То же, но с текстом ошибки сервера (для форм подключения, где пользователю нужно знать, что именно не так).
// opts.cache — для опроса сервера: там нужен no-store, иначе браузер может отдать ответ из кэша.
export async function apiCall<T>(url: string, method = "GET", body?: unknown, opts: { cache?: RequestCache } = {}): Promise<{ ok: boolean; data: T | null; message: string; code: string; status: number }> {
    try {
        const res = await fetch(url, {
            method,
            headers: authHeaders(),
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: opts.cache,
        });
        const json = res.status === 204 ? null : await res.json().catch(() => null);
        if (res.status === 401) sessionExpired();
        if (!res.ok) return { ok: false, data: null, message: json?.message ?? `Error ${res.status}`, code: json?.code ?? "", status: res.status };
        return { ok: true, data: json as T, message: "", code: "", status: res.status };
    } catch {
        return { ok: false, data: null, message: "Network error", code: "", status: 0 };
    }
}

export type ActivityEntity = "deals" | "contacts" | "companies" | "tasks";
export interface NewActivity {
    type: Exclude<ActivityType, "stage" | "created">;
    text: string;
    meta?: string;
}

// Ответ сервера — обновлённый документ целиком (с массивом activities).
export const addActivityRequest = <T extends { activities?: Activity[] }>(entity: ActivityEntity, id: string, activity: NewActivity) =>
    api<T>(`/api/${entity}/${id}/activities`, "POST", activity);

export const removeActivityRequest = <T extends { activities?: Activity[] }>(entity: ActivityEntity, id: string, activityId: string) =>
    api<T>(`/api/${entity}/${id}/activities?activityId=${activityId}`, "DELETE");
