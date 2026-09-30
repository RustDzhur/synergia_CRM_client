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

export type CbPayType = "CASH" | "CARD";

export interface CbReceipt {
    id: string;
    fiscalCode: string;
    url: string; // ссылка на чек для клиента, если Checkbox её вернула
}

// Тело чека: у продажи и возврата оно одинаковое (возврат лишь ссылается на исходный чек),
// поэтому собирается в одном месте — расхождение в копейках/тысячных здесь дороже всего
function receiptBody(input: { goods: CbGood[]; amount: number; cashierName?: string; payType?: CbPayType; delivery?: { emails?: string[]; phone?: string }; previousReceiptId?: string }) {
    return {
        ...(input.cashierName ? { cashier_name: input.cashierName } : {}),
        ...(input.previousReceiptId ? { previous_receipt_id: input.previousReceiptId } : {}),
        goods: input.goods.map((g) => ({
            good: {
                name: g.name.slice(0, 120),
                price: Math.round(g.price * 100), // копейки
                ...(g.taxId ? { tax: [g.taxId] } : {}),
            },
            quantity: Math.max(1, Math.round(g.qty * 1000)), // тысячные
        })),
        // Способ оплаты: карта — деньги приходят на счёт, готівка — в ящик. По правилам РРО чек нужен
        // в обоих случаях, но в отчётности они различаются, поэтому тип приходит снаружи
        payments: [{ type: input.payType ?? "CARD", amount: Math.round(input.amount * 100) }],
        ...(input.delivery && (input.delivery.emails?.length || input.delivery.phone)
            ? { delivery: { ...(input.delivery.emails?.length ? { emails: input.delivery.emails } : {}), ...(input.delivery.phone ? { phone: input.delivery.phone } : {}) } }
            : {}),
    };
}

const receiptFrom = (res: { id?: string; fiscal_code?: string; fiscalCode?: string; tax_url?: string; taxUrl?: string; url?: string; link?: string }): CbReceipt => ({
    id: String(res.id ?? ""),
    fiscalCode: String(res.fiscal_code ?? res.fiscalCode ?? ""),
    // ссылку отдаёт сам Checkbox; если её нет — оставляем пустой, а не выдумываем адрес
    url: String(res.tax_url ?? res.taxUrl ?? res.url ?? res.link ?? ""),
});

/** Чек по id: нужен, когда ссылка не сохранилась (старый чек или ответ без tax_url) — Checkbox
 *  отдаёт её при повторном чтении, и чек снова можно открыть, скачать и распечатать */
export async function receiptById(licenseKey: string, token: string, id: string): Promise<CbReceipt> {
    const res = await cb<{ id?: string; fiscal_code?: string; fiscalCode?: string; tax_url?: string; taxUrl?: string; url?: string; link?: string }>(`/receipts/${encodeURIComponent(id)}`, { licenseKey, token });
    return receiptFrom(res);
}

/** Чек продажи. delivery — куда Checkbox сам отправит копию чека (почта или телефон клиента) */
export async function sellReceipt(
    licenseKey: string,
    token: string,
    input: { goods: CbGood[]; amount: number; cashierName?: string; payType?: CbPayType; delivery?: { emails?: string[]; phone?: string } }
): Promise<CbReceipt> {
    const res = await cb<{ id?: string; fiscal_code?: string; fiscalCode?: string; tax_url?: string; taxUrl?: string; url?: string; link?: string }>("/receipts/sell", {
        method: "POST",
        licenseKey,
        token,
        body: receiptBody(input),
    });
    if (!res.id) throw new ProviderError("Checkbox не повернув чек");
    return receiptFrom(res);
}

/** Чек возврата (кредит-нота): ссылается на исходный чек кассы — без него возврат не сойдётся в ЄРПН */
export async function returnReceipt(
    licenseKey: string,
    token: string,
    input: { goods: CbGood[]; amount: number; previousReceiptId: string; cashierName?: string; payType?: CbPayType; delivery?: { emails?: string[]; phone?: string } }
): Promise<CbReceipt> {
    if (!input.previousReceiptId) throw new ProviderError("Немає чека, до якого зробити повернення — спочатку пробийте чек продажу");
    const res = await cb<{ id?: string; fiscal_code?: string; fiscalCode?: string; tax_url?: string; taxUrl?: string; url?: string; link?: string }>("/receipts/return", {
        method: "POST",
        licenseKey,
        token,
        body: receiptBody(input),
    });
    if (!res.id) throw new ProviderError("Checkbox не повернув чек");
    return receiptFrom(res);
}

// ── Смены и Z-отчёт ─────────────────────────────────────────────────────────────────────────────────
// Чек принимается только при открытой смене. Смену открывают в начале дня, а в конце — закрывают:
// Checkbox формирует Z-отчёт (итоги смены), который и служит подтверждением закрытия.

export interface CbShiftReport {
    id: string; // id закрытой смены
    closedAt: string;
    /** Итоги Z-отчёта: приходят разными полями у разных версий API, поэтому читаем терпимо */
    receipts: number;
    turnover: number;
    raw: Record<string, unknown>;
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Закрытие смены: Checkbox отвечает данными Z-отчёта (счётчики и оборот берём, что есть) */
export async function closeShift(licenseKey: string, token: string, shiftId: string): Promise<CbShiftReport> {
    const res = await cb<Record<string, unknown>>(`/shifts/close`, { method: "POST", licenseKey, token, body: { shift_id: shiftId } });
    const z = (res.z_report ?? res.zReport ?? res) as Record<string, unknown>;
    return {
        id: String(res.id ?? shiftId),
        closedAt: String(res.closed_at ?? res.closedAt ?? new Date().toISOString()),
        receipts: num(z.receipts_count ?? z.receiptsCount ?? z.receipt_count ?? z.count ?? res.receipts_count),
        turnover: num(z.turnover ?? z.sum ?? z.total ?? res.turnover) / 100, // копейки → гривны
        raw: res,
    };
}

/** Список смен кассы: по нему видно, закрыта ли предыдущая и когда её закрывали */
export async function listShifts(licenseKey: string, token: string, limit = 20): Promise<Array<{ id: string; status: string; openedAt: string; closedAt: string }>> {
    const res = await cb<{ results?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(`/shifts?limit=${limit}`, { licenseKey, token }).catch(() => null);
    const rows = Array.isArray(res) ? res : (res?.results ?? []);
    return rows.map((s) => ({
        id: String(s.id ?? ""),
        status: String(s.status ?? ""),
        openedAt: String(s.opened_at ?? s.openedAt ?? ""),
        closedAt: String(s.closed_at ?? s.closedAt ?? ""),
    })).filter((s) => s.id);
}
