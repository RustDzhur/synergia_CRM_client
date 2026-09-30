import { ProviderError, fetchProvider } from "@/lib/http";

// ПРРО Checkbox: фискальные чеки для украинских фирм. Устройство API такое:
//   • на каждом запросе — заголовок X-License-Key (ключ кассы из кабинета Checkbox);
//   • перед работой кассир входит (POST /cashier/signin, логин и пароль) и получает access_token,
//     дальше он идёт в заголовке Authorization: Bearer;
//   • чеки принимаются только при открытой смене: её открывают один раз в день (POST /shifts).
// Суммы Checkbox принимает в копейках, количество — в тысячных долях (1 шт = 1000): это частая
// причина «чека на 1 копейку», поэтому перевод делаем здесь и только здесь.

const base = () => (process.env.CHECKBOX_API_URL || "https://api.checkbox.in.ua/api/v1").replace(/\/+$/, "");

interface CbError { message?: string; detail?: string; errors?: unknown }

async function cb<T>(path: string, opts: { method?: string; licenseKey: string; token?: string; body?: unknown }): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, {
        method: opts.method ?? "GET",
        headers: {
            "Content-Type": "application/json",
            "X-License-Key": opts.licenseKey,
            "X-Client-Name": "Firmspace CRM",
            "X-Client-Version": "1.0",
            ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        },
        ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
    const json = (await res.json().catch(() => null)) as (T & CbError) | null;
    if (!res.ok || !json) {
        const detail = json?.message || json?.detail || (typeof json?.errors === "string" ? json.errors : "");
        // Самые частые отказы объясняем словами: их видит бухгалтер, а не разработчик
        if (res.status === 401 || res.status === 403) throw new ProviderError(detail || "Checkbox відхилив ключ каси або пароль касира");
        if (res.status === 422) throw new ProviderError(detail || "Checkbox не прийняв чек — перевірте дані каси та ставки ПДВ");
        throw new ProviderError(detail || `Checkbox відповів помилкою ${res.status}`);
    }
    return json as T;
}

/** Вход кассира: возвращает access_token, с которым работают остальные запросы */
export async function signIn(licenseKey: string, login: string, password: string): Promise<string> {
    const res = await cb<{ access_token?: string }>("/cashier/signin", { method: "POST", licenseKey, body: { login, password } });
    if (!res.access_token) throw new ProviderError("Checkbox не видав токен касира");
    return res.access_token;
}

export interface CbShift { id: string; status?: string }

/** Текущая открытая смена: чек без смены не принимается, поэтому перед первым чеком её открываем */
export async function currentShift(licenseKey: string, token: string): Promise<CbShift | null> {
    const res = await cb<{ id?: string; status?: string }>("/cashier/shift", { licenseKey, token }).catch(() => null);
    if (!res?.id) return null;
    // закрытая смена в ответе тоже приходит — она нам не подходит
    if (String(res.status ?? "").toUpperCase().includes("CLOS") || String(res.status ?? "") === "2") return null;
    return { id: res.id, status: res.status };
}

export async function openShift(licenseKey: string, token: string): Promise<CbShift> {
    const res = await cb<{ id?: string }>("/shifts", { method: "POST", licenseKey, token, body: {} });
    if (!res.id) throw new ProviderError("Не вдалося відкрити зміну в Checkbox");
    return { id: res.id };
}

export interface CbTax { id: string; label: string; code: string }

/** Ставки налогов кассы: у плательщика ПДВ в позиции чека нужен код налога, у неплательщика — нет */
export async function taxes(licenseKey: string, token: string): Promise<CbTax[]> {
    const res = await cb<{ results?: { id?: string; label?: string; code?: string; description?: string }[] }>("/taxes", { licenseKey, token }).catch(() => null);
    return (res?.results ?? []).map((t) => ({ id: String(t.id ?? ""), label: String(t.label ?? t.description ?? ""), code: String(t.code ?? "") })).filter((t) => t.id);
}

export interface CbGood {
    name: string;
    price: number; // гривны (в запрос уйдут копейки)
    qty: number; // штуки (в запрос уйдут тысячные)
    taxId?: string;
}

export interface CbReceipt {
    id: string;
    fiscalCode: string;
    url: string; // ссылка на чек для клиента, если Checkbox её вернула
}

/** Чек продажи. delivery — куда Checkbox сам отправит копию чека (почта или телефон клиента) */
export async function sellReceipt(
    licenseKey: string,
    token: string,
    input: { goods: CbGood[]; amount: number; cashierName?: string; delivery?: { emails?: string[]; phone?: string } }
): Promise<CbReceipt> {
    const body = {
        ...(input.cashierName ? { cashier_name: input.cashierName } : {}),
        goods: input.goods.map((g) => ({
            good: {
                name: g.name.slice(0, 120),
                price: Math.round(g.price * 100), // копейки
                ...(g.taxId ? { tax: [g.taxId] } : {}),
            },
            quantity: Math.max(1, Math.round(g.qty * 1000)), // тысячные
        })),
        // чек закрывается картой: деньги приходят на счёт, а не в ящик — так и помечаем
        payments: [{ type: "CARD", amount: Math.round(input.amount * 100) }],
        ...(input.delivery && (input.delivery.emails?.length || input.delivery.phone)
            ? { delivery: { ...(input.delivery.emails?.length ? { emails: input.delivery.emails } : {}), ...(input.delivery.phone ? { phone: input.delivery.phone } : {}) } }
            : {}),
    };
    const res = await cb<{ id?: string; fiscal_code?: string; fiscalCode?: string; tax_url?: string; taxUrl?: string; url?: string; link?: string }>("/receipts/sell", {
        method: "POST",
        licenseKey,
        token,
        body,
    });
    if (!res.id) throw new ProviderError("Checkbox не повернув чек");
    return {
        id: String(res.id),
        fiscalCode: String(res.fiscal_code ?? res.fiscalCode ?? ""),
        // ссылку отдаёт сам Checkbox; если её нет — оставляем пустой, а не выдумываем адрес
        url: String(res.tax_url ?? res.taxUrl ?? res.url ?? res.link ?? ""),
    };
}
