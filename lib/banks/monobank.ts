import { ProviderError } from "@/lib/http";

// Банковская выписка monobank по открытому API (https://api.monobank.ua): фирма берёт токен в
// личном кабинете (ФОП — там же, где личные счета) и вставляет его в разделе «Банк и касса».
// Тонкий клиент, как у остальных интеграций: адреса, заголовки и разбор ответа в одном месте,
// поэтому проверяется офлайн-тестом с подменённым fetch (сеть в песочнице недоступна).
//
// Особенности, которые здесь учтены:
// • суммы приходят в копейках (минорных единицах), время — в секундах Unix;
// • выписка отдаётся окнами не больше 31 дня и не больше 500 строк за запрос —
//   длинный период режем на окна и склеиваем;
// • 401 — неверный токен, 429 — «зачекайте» (лимит обращений), оба текста показываем человеку.

const BASE = "https://api.monobank.ua";
export const MONOBANK_WINDOW_SEC = 31 * 24 * 60 * 60 - 3600; // максимум API: 31 день и 1 час

export interface MonobankAccount {
    id: string;
    name: string;
    currency: string; // ISO 4217 из числового кода
    balance: number; // в основных единицах (гривна/евро), знак сохранён
    iban: string;
    kind: string; // тип счёта из ответа monobank (black/white/fop/…)
}

export interface MonobankTx {
    externalId: string; // id строки выписки — по нему повторная синхронизация не задваивает движения
    date: string; // YYYY-MM-DD по времени операции
    time: number; // unix, секунды
    amount: number; // плюс — приход, минус — расход (в основных единицах)
    currency: string;
    counterparty: string; // контрагент, как его пишет банк
    reference: string; // назначение платежа
}

// Числовые коды валют ISO 4217, которые реально встречаются у monobank
const CURRENCIES: Record<number, string> = { 980: "UAH", 978: "EUR", 840: "USD", 826: "GBP", 985: "PLN" };
export const currencyOf = (code: number): string => CURRENCIES[Number(code)] ?? String(Number(code) || "");

/** Деньги monobank в копейках → основные единицы (без плавающих хвостов: /100 и округление до копейки). */
export const majorUnits = (minor: number): number => Math.round(Number(minor) || 0) / 100;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** «2026-09-30» → unix-секунды начала дня (UTC); кривую дату встречает вызывающий, здесь — NaN. */
export function unixFromDate(date: string): number {
    const m = DAY.exec(String(date ?? ""));
    return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 1000) : NaN;
}
const dateFromUnix = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

// Ответы monobank — свободная форма; читаем только нужные поля и не падаем на незнакомых
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

async function request<T>(path: string, token: string): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${BASE}${path}`, { headers: { "X-Token": token }, cache: "no-store" });
    } catch {
        throw new ProviderError("monobank недоступний: перевірте з'єднання і спробуйте ще раз");
    }
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
        const body = json as { errorDescription?: string } | null;
        if (res.status === 401) throw new ProviderError("monobank не прийняв токен: скопіюйте його з кабінету api.monobank.ua ще раз");
        if (res.status === 429) throw new ProviderError("monobank просить зачекати: забагато запитів, спробуйте за годину");
        if (res.status === 403) throw new ProviderError("Доступ заборонено: токен має бути з кабінету api.monobank.ua (не з застосунку)");
        throw new ProviderError(body?.errorDescription || `monobank відповів помилкою ${res.status}`);
    }
    return json as T;
}

interface MonoClientInfo {
    clientId?: string;
    name?: string;
    accounts?: Array<{ id?: string; type?: string; currencyCode?: number; balance?: number; iban?: string; maskedPan?: string[] }>;
}

/** Клиент и его счета: используется и для проверки токена, и для списка счетов в окне подключения. */
export async function monobankClient(token: string): Promise<{ clientId: string; name: string; accounts: MonobankAccount[] }> {
    if (!token.trim()) throw new ProviderError("Вставте токен monobank");
    const info = await request<MonoClientInfo>("/personal/client-info", token.trim());
    const accounts = (info.accounts ?? []).map((a) => ({
        id: str(a.id, 60),
        name: str(a.iban ? `${a.type ?? "Счет"} · ${a.iban.slice(-4)}` : a.type, 100) || "Счет monobank",
        currency: currencyOf(num(a.currencyCode)),
        balance: majorUnits(num(a.balance)),
        iban: str(a.iban, 40),
        kind: str(a.type, 40),
    })).filter((a) => a.id);
    return { clientId: str(info.clientId, 60), name: str(info.name, 120), accounts };
}

/**
 * Выписка по счёту за период: [from; to] — unix-секунды. Период длиннее окна API (31 день)
 * разрезается на окна, строки склеиваются, дубли по id убираются. to ≤ сейчас.
 */
export async function monobankStatement(token: string, accountId: string, fromSec: number, toSec = Math.floor(Date.now() / 1000)): Promise<MonobankTx[]> {
    if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || fromSec >= toSec) return [];
    const out = new Map<string, MonobankTx>();
    let windowStart = fromSec;
    // Ограничение сверху — 10 окон (≈10 месяцев за один синхрон): защита от случайного «с прошлого века»
    for (let i = 0; windowStart < toSec && i < 10; i++) {
        const windowEnd = Math.min(windowStart + MONOBANK_WINDOW_SEC, toSec);
        const rows = await request<Array<{ id?: string; time?: number; description?: string; comment?: string; amount?: number; currencyCode?: number; counterName?: string }>>(
            `/personal/statement/${encodeURIComponent(accountId)}/${windowStart}/${windowEnd}`,
            token.trim()
        );
        for (const r of Array.isArray(rows) ? rows : []) {
            const id = str(r.id, 60);
            if (!id) continue;
            const time = num(r.time);
            out.set(id, {
                externalId: id,
                time,
                date: time > 0 ? dateFromUnix(time) : dateFromUnix(windowStart),
                amount: majorUnits(num(r.amount)),
                currency: currencyOf(num(r.currencyCode)),
                counterparty: str(r.counterName ?? r.description, 200),
                reference: str(r.comment ?? r.description, 300),
            });
        }
        windowStart = windowEnd;
    }
    return Array.from(out.values()).sort((a, b) => a.time - b.time);
}

/**
 * Окно синхронизации: с прошлой синхронизации (или с даты начала учёта), но не глубже месяца назад —
 * выписка за годы при первом подключении не нужна и упёрлась бы в лимит обращений.
 */
export function syncWindow(lastSyncAt: Date | null | undefined, openingDate: string, nowSec = Math.floor(Date.now() / 1000)): { from: number; to: number } {
    const floor = nowSec - 31 * 24 * 60 * 60;
    const base = lastSyncAt ? Math.floor(lastSyncAt.getTime() / 1000) - 24 * 60 * 60 : Math.max(unixFromDate(openingDate) || floor, floor);
    return { from: Math.min(base, nowSec), to: nowSec };
}
