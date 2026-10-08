import { fetchProvider } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { financeSettings } from "./settings";
import { marketOf } from "./market";

// Курсы валют для украинских фирм: НБУ отдаёт их открытым списком без ключа. Кэшируем на несколько
// часов — курс меняется раз в день, а дёргать Нацбанк на каждый счёт незачем. Фирма может работать
// не по чистому курсу, а с наценкой («НБУ + 2 %») — это её решение, поэтому наценка в настройках.

const RATES_KEY = "nbuRates";
const CACHE_MS = 6 * 60 * 60 * 1000; // шесть часов
const NBU_URL = () => process.env.NBU_RATES_URL || "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json";

export interface Rates {
    USD: number;
    EUR: number;
    at: string; // дата курса от НБУ
}

interface Cached { rates: Rates; fetchedAt: number }

async function readCache(): Promise<Cached | null> {
    try {
        const doc = await prisma.platformSettings.findUnique({ where: { key: RATES_KEY } });
        if (!doc?.value) return null;
        const parsed = JSON.parse(doc.value) as Cached;
        return parsed?.rates?.USD ? parsed : null;
    } catch {
        return null;
    }
}

async function writeCache(rates: Rates): Promise<void> {
    try {
        const value = JSON.stringify({ rates, fetchedAt: Date.now() });
        const existing = await prisma.platformSettings.findUnique({ where: { key: RATES_KEY } });
        if (existing) await prisma.platformSettings.update({ where: { key: RATES_KEY }, data: { value } });
        else await prisma.platformSettings.create({ data: { key: RATES_KEY, value } });
    } catch {
        // кэш — не критичная часть: без него просто спросим НБУ ещё раз
    }
}

/** Курсы НБУ к гривне. Ответ Нацбанка: [{ cc: "USD", rate: 41.5, exchangedate: "30.09.2026" }, …] */
export async function nbuRates(): Promise<Rates | null> {
    const cached = await readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.rates;
    try {
        const res = await fetchProvider(NBU_URL(), { headers: { Accept: "application/json" } });
        const json = (await res.json().catch(() => null)) as { cc?: string; rate?: number; exchangedate?: string }[] | null;
        if (!res.ok || !Array.isArray(json)) return cached?.rates ?? null;
        const find = (cc: string) => json.find((r) => String(r.cc ?? "").toUpperCase() === cc);
        const usd = find("USD");
        const eur = find("EUR");
        if (!usd?.rate || !eur?.rate) return cached?.rates ?? null;
        const rates: Rates = { USD: Number(usd.rate), EUR: Number(eur.rate), at: String(usd.exchangedate ?? "") };
        await writeCache(rates);
        return rates;
    } catch {
        // Сеть до НБУ могла пропасть — отдаём прошлый курс, если он есть: счёт важнее свежести на день
        return cached?.rates ?? null;
    }
}

// ── Узбекистан: курс Центрального банка (cbu.uz) к суму ──────────────────────────────────────────────────
// Курс ЦБ фиксируется на дату документа и потом не пересчитывается (в документе хранится снимок). Адрес JSON по источникам
// docs/TZ_UZBEKISTAN_AND_ROBOTS.md (раздел 7.7) нужно сверить на cbu.uz → «Архив курсов валют» → «Веб-мастерам»; он вынесен в
// переменную CBU_RATES_URL, поэтому правится без выкладки кода. Ответ: [{ Ccy: "USD", Rate: "12345.67", Nominal: "1", Date: "08.10.2026" }, …].
const CBU_URL = (ccy?: string, date?: string) =>
    ccy && date
        ? (process.env.CBU_RATES_DATE_URL || "https://cbu.uz/ru/arkhiv-kursov-valyut/json/{ccy}/{date}/").replace("{ccy}", encodeURIComponent(ccy)).replace("{date}", encodeURIComponent(date))
        : process.env.CBU_RATES_URL || "https://cbu.uz/ru/arkhiv-kursov-valyut/json/";

export interface CbuRow { Ccy?: string; Rate?: string | number; Nominal?: string | number; Date?: string }

/** Курс одной единицы валюты в сумах из строки ответа ЦБ (с учётом номинала). */
export function cbuRowRate(row: CbuRow | undefined): { rate: number; at: string } | null {
    if (!row) return null;
    const rate = Number(String(row.Rate ?? "").replace(",", "."));
    const nominal = Number(row.Nominal) || 1;
    if (!(rate > 0)) return null;
    // дата в ответе — дд.мм.гггг; храним ISO
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(row.Date ?? ""));
    return { rate: rate / nominal, at: m ? `${m[3]}-${m[2]}-${m[1]}` : String(row.Date ?? "") };
}

/** Курс ЦБ Узбекистана: валюта к суму на дату (YYYY-MM-DD) или на сегодня. Кэш — в PlatformSettings; нет сети — прошлый курс из кэша. */
export async function cbuRate(currency: string, date?: string): Promise<{ rate: number; at: string } | null> {
    const code = currency.toUpperCase();
    if (code === "UZS") return { rate: 1, at: date ?? "" };
    const key = `cbu:${code}:${date ?? "latest"}`;
    type CbuCache = { rate: number; at: string; fetchedAt: number };
    let cached = null as CbuCache | null;
    try {
        const doc = await prisma.platformSettings.findUnique({ where: { key } });
        cached = doc?.value ? (JSON.parse(doc.value) as CbuCache) : null;
    } catch { cached = null; }
    // курс на конкретную дату не меняется — кэш вечный; «сегодняшний» — шесть часов
    if (cached?.rate && (date || Date.now() - cached.fetchedAt < CACHE_MS)) return { rate: cached.rate, at: cached.at };
    try {
        const res = await fetchProvider(CBU_URL(date ? code : undefined, date), { headers: { Accept: "application/json" } });
        const json = (await res.json().catch(() => null)) as CbuRow[] | null;
        if (!res.ok || !Array.isArray(json)) return cached?.rate ? { rate: cached.rate, at: cached.at } : null;
        const found = cbuRowRate(json.find((r) => String(r.Ccy ?? "").toUpperCase() === code));
        if (!found) return cached?.rate ? { rate: cached.rate, at: cached.at } : null;
        try {
            const value = JSON.stringify({ ...found, fetchedAt: Date.now() });
            await prisma.platformSettings.upsert({ where: { key }, create: { key, value }, update: { value } });
        } catch { /* кэш не критичен */ }
        return found;
    } catch {
        return cached?.rate ? { rate: cached.rate, at: cached.at } : null;
    }
}

export interface FirmRate { rate: number; base: number; margin: number; at: string; /** национальная валюта, к которой дан курс (по умолчанию UAH) */ home?: string }

/** Курс фирмы к национальной валюте рынка: UA — НБУ к гривне, UZ — ЦБ Узбекистана к суму; плюс наценка фирмы (0 — чистый курс). */
export async function firmRate(org: string, currency: string, date?: string): Promise<FirmRate | null> {
    const code = currency.toUpperCase();
    const settings0 = await financeSettings(org);
    if (marketOf(settings0.country) === "UZ") {
        if (code === "UZS") return { rate: 1, base: 1, margin: 0, at: "", home: "UZS" };
        const cbu = await cbuRate(code, date);
        if (!cbu) return null;
        const margin = Number(settings0.rateMargin) || 0;
        return { rate: Math.round(cbu.rate * (1 + margin / 100) * 100) / 100, base: cbu.rate, margin, at: cbu.at, home: "UZS" };
    }
    if (code === "UAH") return { rate: 1, base: 1, margin: 0, at: "" };
    const rates = await nbuRates();
    const base = rates?.[code as "USD" | "EUR"];
    if (!base) return null;
    const settings = await financeSettings(org);
    const margin = Number(settings.rateMargin) || 0;
    return { rate: Math.round(base * (1 + margin / 100) * 10000) / 10000, base, margin, at: rates?.at ?? "" };
}
