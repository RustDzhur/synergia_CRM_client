// GET /api/currency — актуальные курсы EUR → местные валюты для показа цен на лендинге.
// Курс тянется с бесплатного сервиса (open.er-api.com, без ключа) и кэшируется в памяти процесса
// на 12 часов, чтобы не дёргать внешний API на каждый визит. Если сервис недоступен или вернул
// мусор — отдаём приблизительные курсы (lib/currency.ts FALLBACK_RATES), лендинг не ломается.
import { NextResponse } from "next/server";
import { FALLBACK_RATES } from "@/lib/currency";

// Наружу нужны только три валюты — остальные ~160 не отдаём.
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

async function eurRates(): Promise<Record<string, number>> {
	if (cache && Date.now() - cache.at < TTL) return cache.rates;
	if (failedAt && Date.now() - failedAt < RETRY_AFTER_FAIL) return cache?.rates ?? FALLBACK_RATES;
	// single-flight: одновременные запросы при холодном кэше делают один внешний запрос, а не N
	inflight ??= loadRates().finally(() => { inflight = null; });
	return inflight;
}

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json({ rates: await eurRates() });
}
