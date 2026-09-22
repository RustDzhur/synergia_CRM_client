import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { COUNTRY_CODES, COUNTRY_TAX } from "@/lib/finance/taxRates";
import { financeSettings } from "@/lib/finance/settings";
import FinanceSettings from "@/models/FinanceSettings";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

function toDTO(s: any) {
    return {
        country: s.country ?? "",
        currency: s.currency ?? "EUR",
        smallBusiness: !!s.smallBusiness,
        legalName: s.legalName ?? "",
        address: s.address ?? "",
        taxId: s.taxId ?? "",
        iban: s.iban ?? "",
        bic: s.bic ?? "",
        paymentTermsDays: s.paymentTermsDays ?? 14,
        invoicePrefix: s.invoicePrefix ?? "RE",
        quotePrefix: s.quotePrefix ?? "AN",
    };
}

// GET /api/finance/settings — настройки фирмы + справочник стран со ставками (для выпадающего списка в интерфейсе)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const s = await financeSettings(user.id);
    return NextResponse.json({ settings: toDTO(s), countries: COUNTRY_CODES.map((code) => ({ code, ...COUNTRY_TAX[code] })) });
}

// PATCH /api/finance/settings — обновить (владелец/администратор — модуль inventory уже это требует для не-GET)
export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const set: Record<string, unknown> = {};
    if (typeof b.country === "string") set.country = COUNTRY_CODES.includes(b.country) ? b.country : "";
    const currency = str(b.currency, 6); if (currency !== undefined) set.currency = currency.toUpperCase();
    if (typeof b.smallBusiness === "boolean") set.smallBusiness = b.smallBusiness;
    for (const k of ["legalName", "address", "taxId", "iban", "bic", "invoicePrefix", "quotePrefix"] as const) {
        const v = str(b[k], k === "address" ? 500 : 100);
        if (v !== undefined) set[k] = v;
    }
    if (b.paymentTermsDays !== undefined) {
        const n = Number(b.paymentTermsDays);
        if (Number.isFinite(n) && n >= 0 && n <= 365) set.paymentTermsDays = Math.round(n);
    }
    const s = await FinanceSettings.findOneAndUpdate({ org: user.id }, { $set: set }, { upsert: true, new: true });
    return NextResponse.json(toDTO(s));
}
