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
    };
}

// Обёртка над fetch: при ошибке (сеть или статус не 2xx) возвращает null, а не бросает исключение.
export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T | null> {
    try {
        const res = await fetch(url, {
            method,
            headers: authHeaders(),
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

// То же, но с текстом ошибки сервера (для форм подключения, где пользователю нужно знать, что именно не так)
export async function apiCall<T>(url: string, method = "GET", body?: unknown): Promise<{ ok: boolean; data: T | null; message: string; status: number }> {
    try {
        const res = await fetch(url, {
            method,
            headers: authHeaders(),
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const json = res.status === 204 ? null : await res.json().catch(() => null);
        if (!res.ok) return { ok: false, data: null, message: json?.message ?? `Error ${res.status}`, status: res.status };
        return { ok: true, data: json as T, message: "", status: res.status };
    } catch {
        return { ok: false, data: null, message: "Network error", status: 0 };
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
