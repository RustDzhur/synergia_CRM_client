import { ProviderError, fetchProvider } from "@/lib/http";

// Укрпошта: отслеживание отправлений по штрихкоду. Адрес и формат — из их документации
// (Status-tracking API, версия 04.03.2026): GET /status-tracking/0.0.1/statuses[/last]?barcode=…
// с заголовком Authorization: Bearer <bearer_Uuid>. Токен выдаёт сама Укрпошта после договора.
//
// Создание отправления (ecom) здесь не делаем: оно требует договора, идентификаторов контрагента
// и адресного классификатора — это отдельная работа, а трекинг нужен раньше и работает сам.

const base = () => (process.env.UKRPOSHTA_API_URL || "https://www.ukrposhta.ua/status-tracking/0.0.1").replace(/\/+$/, "");

interface UpStatus {
    barcode?: string;
    step?: number;
    date?: string;
    index?: string;
    name?: string;
    event?: number;
    eventName?: string;
    country?: string;
    eventReason?: string;
}

async function call<T>(token: string, path: string): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const json = (await res.json().catch(() => null)) as (T & { message?: string; error?: string }) | null;
    if (res.status === 401 || res.status === 403) throw new ProviderError("Укрпошта відхилила токен — перевірте bearer-токен із кабінету");
    if (!res.ok || !json) throw new ProviderError(json?.message ?? json?.error ?? `Укрпошта відповіла помилкою ${res.status}`);
    return json as T;
}

/** Проверка токена при подключении: 401 значит «токен не тот», любой другой ответ — токен рабочий.
 *  Отправление при этом может быть не найдено — это не ошибка подключения. */
export async function checkToken(token: string): Promise<void> {
    await call<unknown>(token, "/statuses/last?barcode=RB000000000UA").catch((e) => {
        if (e instanceof ProviderError && /токен/.test(e.message)) throw e;
    });
}

export interface UpTracking {
    barcode: string;
    status: string; // описание последней операции
    at: string; // когда она случилась
    place: string; // индекс и отделение
    event: number;
}

/** Последний статус по каждому штрихкоду. Укрпошта принимает список ШКІ в одном запросе. */
export async function trackLast(token: string, barcodes: string[]): Promise<UpTracking[]> {
    const list = barcodes.filter(Boolean);
    if (!list.length) return [];
    const query = list.map((b) => `barcode=${encodeURIComponent(b)}`).join("&");
    const data = await call<UpStatus[]>(token, `/statuses/last?${query}`);
    const rows = Array.isArray(data) ? data : [];
    return rows.map((s) => ({
        barcode: String(s.barcode ?? ""),
        status: String(s.eventName ?? ""),
        at: String(s.date ?? ""),
        place: [s.index, s.name].filter(Boolean).join(" "),
        event: Number(s.event) || 0,
    }));
}
