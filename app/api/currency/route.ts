// GET /api/currency — актуальные курсы EUR → местные валюты для показа цен на лендинге.
// Курс тянется с бесплатного сервиса (open.er-api.com, без ключа) и кэшируется в памяти процесса
// на 12 часов, чтобы не дёргать внешний API на каждый визит. Если сервис недоступен — отдаём
// приблизительные курсы (lib/currency.ts FALLBACK_RATES), лендинг при этом не ломается.
import { NextResponse } from "next/server";
import { FALLBACK_RATES } from "@/lib/currency";

let cache: { rates: Record<string, number>; at: number } | null = null;
const TTL = 12 * 60 * 60 * 1000; // 12 часов

async function eurRates(): Promise<Record<string, number>> {
	if (cache && Date.now() - cache.at < TTL) return cache.rates;
	try {
		const res = await fetch("https://open.er-api.com/v6/latest/EUR", {
			signal: AbortSignal.timeout(8000),
			cache: "no-store",
		});
		const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
		if (json?.result === "success" && json.rates) {
			cache = { rates: json.rates, at: Date.now() };
			return json.rates;
		}
	} catch {
		/* внешний сервис недоступен — ниже вернём приблизительные курсы */
	}
	return FALLBACK_RATES;
}

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json({ rates: await eurRates() });
}
