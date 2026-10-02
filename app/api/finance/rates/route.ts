import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { firmRate, nbuRates } from "@/lib/finance/rates";

export const dynamic = "force-dynamic";

// GET /api/finance/rates — курсы НБУ и курс фирмы (с её наценкой): по ним считается гривневая сумма
// счёта в иностранной валюте. Ответ кэшируется на несколько часов в самой lib/finance/rates.ts.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const rates = await nbuRates();
    const usd = await firmRate(user.id, "USD");
    const eur = await firmRate(user.id, "EUR");
    return NextResponse.json({ rates, firm: { USD: usd, EUR: eur } });
}
