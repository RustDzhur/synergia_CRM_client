import { ProviderError, fetchProvider } from "@/lib/http";

// Укрпошта: отправления и статусы. Два API:
//   • трекинг — GET /status-tracking/0.0.1/statuses[/last]?barcode=… с Authorization: Bearer <token>;
//   • отправления (ecom) — https://www.ukrposhta.ua/ecom/0.0.1/... с тем же токеном параметром ?token=.
// Токен выдаёт сама Укрпошта после договора; без договора создать отправление нельзя — это её правило,
// а не наше: в интерфейсе об этом сказано прямо.
//
// ВАЖНО для вызывающих: ecom принимает вес в ГРАММАХ (1 кг = 1000) и суммы в КОПЕЙКАХ (1 ₴ = 100).
// Перевод — только здесь, в одном месте: это самая частая причина «посылки на 2 грамма».
//
// Всё создание отправления помечено «не проверено на реальном сервисе»: нужен договор и живой токен.

const base = () => (process.env.UKRPOSHTA_API_URL || "https://www.ukrposhta.ua/status-tracking/0.0.1").replace(/\/+$/, "");
const ecom = () => (process.env.UKRPOSHTA_ECOM_URL || "https://www.ukrposhta.ua/ecom/0.0.1").replace(/\/+$/, "");

async function ecomCall<T>(token: string, path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetchProvider(`${ecom()}${path}${sep}token=${encodeURIComponent(token)}`, {
        method: opts.method ?? "GET",
        headers: { "Content-Type": "application/json", ...(opts.body === undefined ? {} : {}) },
        ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
    const json = (await res.json().catch(() => null)) as (T & { message?: string; error?: string }) | null;
    if (res.status === 401 || res.status === 403) throw new ProviderError("Укрпошта відхилила токен — перевірте bearer-токен із кабінету");
    if (!res.ok || !json) throw new ProviderError(json?.message ?? json?.error ?? `Укрпошта відповіла помилкою ${res.status}`);
    return json as T;
}

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

// ── Отправления (ecom) ──────────────────────────────────────────────────────────────────────────────
// Отправление создаётся от имени контрагента по договору (counterparty uuid) и адреса отправки
// (address uuid из справочника фирмы). Получатель — либо отделение (id из справочника отделений),
// либо адрес курьером. Всё это требует рабочего договора: без него Укрпошта отвечает отказом.

export interface UpCounterparty { uuid: string; name: string; phone?: string }
export interface UpAddress { id: string; name: string; postcode?: string }
export interface UpPostOffice { id: string; name: string; postcode?: string; city?: string }

/** Контрагенты фирмы по договору: от их имени создаются отправления */
export async function counterparties(token: string): Promise<UpCounterparty[]> {
    const data = await ecomCall<{ entries?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(token, "/counterparties");
    const rows = Array.isArray(data) ? data : (data.entries ?? []);
    return rows
        .map((c) => ({ uuid: String(c.uuid ?? c.id ?? ""), name: String(c.name ?? ""), phone: String(c.phoneNumber ?? c.phone ?? "") }))
        .filter((c) => c.uuid);
}

/** Адреса отправки контрагента (отделения, из которых фирма отправляет) */
export async function senderAddresses(token: string, counterpartyUuid: string): Promise<UpAddress[]> {
    const data = await ecomCall<{ entries?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(token, `/addresses?counterpartyUuid=${encodeURIComponent(counterpartyUuid)}`);
    const rows = Array.isArray(data) ? data : (data.entries ?? []);
    return rows
        .map((a) => ({ id: String(a.id ?? ""), name: String(a.name ?? a.description ?? ""), postcode: String(a.postcode ?? "") }))
        .filter((a) => a.id);
}

/** Справочник отделений: по нему выбирается отделение получателя (поиск по городу или индексу) */
export async function postOffices(token: string, search = "", limit = 20): Promise<UpPostOffice[]> {
    const data = await ecomCall<{ entries?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        token,
        `/postoffices?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`
    );
    const rows = Array.isArray(data) ? data : (data.entries ?? []);
    return rows
        .map((p) => ({ id: String(p.id ?? ""), name: String(p.name ?? p.description ?? ""), postcode: String(p.postcode ?? ""), city: String(p.city ?? "") }))
        .filter((p) => p.id);
}

export interface UpShipmentInput {
    senderUuid: string; // адрес отправки (uuid из /addresses)
    recipientName: string;
    recipientPhone: string;
    postOfficeId: string; // отделение получателя
    weightKg: number;
    declaredValue: number; // объявленная стоимость, ₴
    codAmount?: number; // наложенный платёж, ₴
    description: string;
    length?: number; // см
    width?: number;
    height?: number;
}

export interface UpShipment { uuid: string; barcode: string }

/**
 * Создание отправления «відділення → відділення». Вес у API — граммы, суммы — копейки;
 * перевод делается здесь (Math.round), иначе посылка ушла бы «на 2 грамма».
 * Укрпошта сама назначает штрихкод — его и называют клиенту.
 */
export async function createShipment(token: string, input: UpShipmentInput): Promise<UpShipment> {
    const body = {
        sender: { uuid: input.senderUuid },
        recipient: {
            name: input.recipientName.slice(0, 100),
            phone: input.recipientPhone.replace(/\D/g, ""),
            address: { id: input.postOfficeId },
        },
        deliveryType: "W2W",
        weight: Math.max(1, Math.round((input.weightKg || 0) * 1000)),
        ...(input.length ? { length: Math.round(input.length) } : {}),
        ...(input.width ? { width: Math.round(input.width) } : {}),
        ...(input.height ? { height: Math.round(input.height) } : {}),
        declaredPrice: Math.max(0, Math.round((input.declaredValue || 0) * 100)),
        ...(input.codAmount ? { postPay: Math.round(input.codAmount * 100) } : {}),
        description: input.description.slice(0, 200) || "Товар",
    };
    const data = await ecomCall<{ uuid?: string; barcode?: string; id?: string }>(token, "/shipments", { method: "POST", body });
    const uuid = String(data.uuid ?? data.id ?? "");
    const barcode = String(data.barcode ?? "");
    if (!uuid || !barcode) throw new ProviderError("Укрпошта не повернула номер відправлення");
    return { uuid, barcode };
}

/** Печатная форма отправления (100×100) — адрес для серверного прокси, токен внутри */
export function shipmentFormUrl(token: string, uuid: string): string {
    return `${ecom()}/shipments/${encodeURIComponent(uuid)}/form?token=${encodeURIComponent(token)}`;
}

/** Отмена отправления — возможна, пока его не приняли в отделении */
export async function cancelShipment(token: string, uuid: string): Promise<void> {
    await ecomCall(token, `/shipments/${encodeURIComponent(uuid)}`, { method: "DELETE" });
}
