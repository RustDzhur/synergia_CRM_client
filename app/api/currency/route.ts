// GET /api/currency — актуальные курсы EUR → местные валюты для показа цен на лендинге.
// Само получение и кэш живут в lib/currencyServer.ts: тот же курс используют тексты FAQ и
// документации и разметка JSON-LD, поэтому кэш общий и внешний сервис дёргается один раз.
import { NextResponse } from "next/server";
import { getRates } from "@/lib/currencyServer";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json({ rates: await getRates() });
}
