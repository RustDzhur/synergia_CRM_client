// Курсы EUR → местные валюты для показа цен: карточки тарифов на лендинге, тексты FAQ и
// документации и разметка JSON-LD. Один общий кэш в памяти процесса на 12 часов, чтобы внешний
// сервис (open.er-api.com, без ключа) не дёргался на каждый рендер; при сбое — последний известный
// курс или FALLBACK_RATES, поэтому страница никогда не падает из-за курса.
//
// Серверный код может await-ить getRates()/priceTokens() прямо в RSC: тогда первый же HTML
// приходит с правильной ценой, без «прыжка» цены и без расхождения с JSON-LD.
import { FALLBACK_RATES, formatPlanPrice, planCurrency } from "./currency";

// Наружу нужны только три валюты — остальные ~160 не храним и не отдаём.
const NEEDED = ["UAH", "UZS"] as const;
// Разумные границы: курс вне них считаем мусором (ноль, строка, абсурд) и уходим в фолбэк.
const RANGE: Record<string, [number, number]> = { UAH: [10, 200], UZS: [1000, 100000] };

function sane(raw: Record<string, unknown> | undefined): Record<string, number> | null {
	if (!raw) return null;
	const out: Record<string, number> = { EUR: 1 };
	for (const c of NEEDED) {
		const v = Number(raw[c]);
		const [lo, hi] = RANGE[c];
		if (!isFinite(v) || v < lo || v > hi) return null;
		out[c] = v;
	}
	return out;
}

let cache: { rates: Record<string, number>; at: number } | null = null;
let inflight: Promise<Record<string, number>> | null = null;
let failedAt = 0;
const TTL = 12 * 60 * 60 * 1000; // 12 часов
const RETRY_AFTER_FAIL = 10 * 60 * 1000; // после сбоя не дёргаем сервис 10 минут

async function loadRates(): Promise<Record<string, number>> {
	try {
		const res = await fetch("https://open.er-api.com/v6/latest/EUR", {
			signal: AbortSignal.timeout(8000),
			cache: "no-store",
		});
		const json = (await res.json().catch(() => null)) as { result?: string; rates?: Record<string, unknown> } | null;
		const ok = json?.result === "success" ? sane(json.rates) : null;
		if (ok) {
			cache = { rates: ok, at: Date.now() };
			failedAt = 0;
			return ok;
		}
	} catch {
		/* внешний сервис недоступен — ниже вернём приблизительные курсы */
	}
	failedAt = Date.now();
	return cache?.rates ?? FALLBACK_RATES;
}

/** Актуальные курсы (EUR → UAH/UZS). Никогда не бросает: при сбое — последние известные или FALLBACK. */
export async function getRates(): Promise<Record<string, number>> {
	if (cache && Date.now() - cache.at < TTL) return cache.rates;
	if (failedAt && Date.now() - failedAt < RETRY_AFTER_FAIL) return cache?.rates ?? FALLBACK_RATES;
	// single-flight: одновременные запросы при холодном кэше делают один внешний запрос, а не N
	inflight ??= loadRates().finally(() => {
		inflight = null;
	});
	return inflight;
}

// Цена в тексте: для Германии и английской версии — как есть в евро, для Украины и Узбекистана —
// сумма в местной валюте и рядом ориентир в евро, потому что реальная оплата идёт в евро
// (см. lib/transferPay.ts). Так текст не обещает сумму, которой в счёте может не быть.
export function formatPlanPriceWithRef(eur: number, locale: string, rates: Record<string, number>): string {
	const local = formatPlanPrice(eur, locale, rates);
	if (planCurrency(locale) === "EUR" || local === `€${Math.round(eur)}`) return local;
	return `${local} (≈ €${eur})`;
}

/** Цены тарифов для локали одной картой: [[price.standard]], [[price.professional]] и годовые. */
export async function priceTokens(locale: string): Promise<Record<string, string>> {
	const rates = await getRates();
	const p = (eur: number) => formatPlanPriceWithRef(eur, locale, rates);
	return {
		"price.standard": p(20),
		"price.professional": p(53),
		"price.standardYear": p(200),
		"price.professionalYear": p(530),
	};
}
