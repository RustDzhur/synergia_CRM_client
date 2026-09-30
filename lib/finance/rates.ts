import { fetchProvider } from "@/lib/http";
import PlatformSettings from "@/models/PlatformSettings";
import { connectDB } from "@/lib/mongodb";
import { financeSettings } from "./settings";

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
        await connectDB();
        const doc = await PlatformSettings.findOne({ key: RATES_KEY });
        if (!doc?.value) return null;
        const parsed = JSON.parse(doc.value) as Cached;
        return parsed?.rates?.USD ? parsed : null;
    } catch {
        return null;
    }
}

async function writeCache(rates: Rates): Promise<void> {
    try {
        await PlatformSettings.updateOne({ key: RATES_KEY }, { $set: { value: JSON.stringify({ rates, fetchedAt: Date.now() }) } }, { upsert: true });
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

/** Курс фирмы к гривне: НБУ плюс её наценка (0 — чистый курс Нацбанка) */
export async function firmRate(org: string, currency: string): Promise<{ rate: number; base: number; margin: number; at: string } | null> {
    const code = currency.toUpperCase();
    if (code === "UAH") return { rate: 1, base: 1, margin: 0, at: "" };
    const rates = await nbuRates();
    const base = rates?.[code as "USD" | "EUR"];
    if (!base) return null;
    const settings = await financeSettings(org);
    const margin = Number(settings.rateMargin) || 0;
    return { rate: Math.round(base * (1 + margin / 100) * 10000) / 10000, base, margin, at: rates?.at ?? "" };
}
