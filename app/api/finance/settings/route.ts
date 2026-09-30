import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { COUNTRY_CODES, COUNTRY_TAX } from "@/lib/finance/taxRates";
import { financeSettings } from "@/lib/finance/settings";
import { isTemplate } from "@/lib/finance/pdf";
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
        vatId: s.vatId ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        website: s.website ?? "",
        registerNumber: s.registerNumber ?? "",
        managingDirector: s.managingDirector ?? "",
        logo: s.logo ?? "",
        footerText: s.footerText ?? "",
        iban: s.iban ?? "",
        bic: s.bic ?? "",
        paymentTermsDays: s.paymentTermsDays ?? 14,
        invoicePrefix: s.invoicePrefix ?? "RE",
        quotePrefix: s.quotePrefix ?? "AN",
        creditNotePrefix: s.creditNotePrefix ?? "GS",
        deliveryNotePrefix: s.deliveryNotePrefix ?? "LS",
        actPrefix: s.actPrefix ?? "АКТ",
        reminderIntervalDays: s.reminderIntervalDays ?? 7,
        dunningFees: Array.isArray(s.dunningFees) && s.dunningFees.length ? s.dunningFees.map((n: unknown) => Number(n) || 0) : [0, 0, 2.5, 5, 10],
        dunningInterestRate: Number(s.dunningInterestRate) || 0,
        dunningPaymentDays: Number(s.dunningPaymentDays) || 7,
        uaLegalForm: s.uaLegalForm === "tov" ? "tov" : "fop",
        uaGroup: [0, 1, 2, 3].includes(Number(s.uaGroup)) ? Number(s.uaGroup) : 3,
        uaSingleRate: Number(s.uaSingleRate) === 3 ? 3 : 5,
        uaVatPayer: !!s.uaVatPayer,
        uaEsvMonthly: Number(s.uaEsvMonthly) || 1760,
        uaMilitaryRate: Number.isFinite(Number(s.uaMilitaryRate)) ? Number(s.uaMilitaryRate) : 1,
        uaMilitaryFixed: Number.isFinite(Number(s.uaMilitaryFixed)) ? Number(s.uaMilitaryFixed) : 800,
        uaVatLimit: Number(s.uaVatLimit) || 1000000,
        uaVatPeriod: s.uaVatPeriod === "quarter" ? "quarter" : "month",
        template: isTemplate(s.template) ? s.template : "classic",
        paymentQr: s.paymentQr !== false,
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
    // footerText — длинный текст, остальные реквизиты короткие
    for (const k of ["legalName", "address", "taxId", "vatId", "phone", "email", "website", "registerNumber", "managingDirector", "footerText", "iban", "bic", "invoicePrefix", "quotePrefix", "creditNotePrefix", "deliveryNotePrefix", "actPrefix"] as const) {
        const v = str(b[k], k === "address" ? 500 : k === "footerText" ? 1200 : 100);
        if (v !== undefined) set[k] = v;
    }
    // Логотип приходит data-URL из того же ресайза, что и аватар (app/utils/avatar.ts):
    // принимаем только картинку и только до 400 КБ, чтобы PDF не раздувался.
    if (typeof b.logo === "string") {
        set.logo = b.logo.startsWith("data:image/") && b.logo.length <= 400_000 ? b.logo : "";
    }
    if (b.paymentTermsDays !== undefined) {
        const n = Number(b.paymentTermsDays);
        if (Number.isFinite(n) && n >= 0 && n <= 365) set.paymentTermsDays = Math.round(n);
    }
    if (isTemplate(b.template)) set.template = b.template;
    if (typeof b.paymentQr === "boolean") set.paymentQr = b.paymentQr;
    if (b.reminderIntervalDays !== undefined) {
        const n = Number(b.reminderIntervalDays);
        if (Number.isFinite(n) && n >= 1 && n <= 90) set.reminderIntervalDays = Math.round(n);
    }
    // Манаведение: сборы по ступеням (0..4) и проценты за просрочку
    if (Array.isArray(b.dunningFees)) set.dunningFees = b.dunningFees.slice(0, 5).map((n: unknown) => Math.max(0, Number(n) || 0));
    if (b.dunningInterestRate !== undefined) {
        const n = Number(b.dunningInterestRate);
        if (Number.isFinite(n) && n >= 0 && n <= 30) set.dunningInterestRate = n;
    }
    if (b.dunningPaymentDays !== undefined) {
        const n = Number(b.dunningPaymentDays);
        if (Number.isFinite(n) && n >= 1 && n <= 60) set.dunningPaymentDays = Math.round(n);
    }
    // Украинская налоговая модель: набор и границы проверяем здесь, чтобы в документ не попало что угодно
    if (b.uaLegalForm === "fop" || b.uaLegalForm === "tov") set.uaLegalForm = b.uaLegalForm;
    if ([0, 1, 2, 3].includes(Number(b.uaGroup))) set.uaGroup = Number(b.uaGroup);
    if (Number(b.uaSingleRate) === 3 || Number(b.uaSingleRate) === 5) set.uaSingleRate = Number(b.uaSingleRate);
    if (typeof b.uaVatPayer === "boolean") set.uaVatPayer = b.uaVatPayer;
    if (b.uaVatPeriod === "month" || b.uaVatPeriod === "quarter") set.uaVatPeriod = b.uaVatPeriod;
    for (const [key, max] of [["uaEsvMonthly", 100000], ["uaMilitaryFixed", 100000], ["uaVatLimit", 100000000], ["uaMilitaryRate", 100]] as const) {
        if (b[key] !== undefined) {
            const n = Number(b[key]);
            if (Number.isFinite(n) && n >= 0 && n <= max) set[key] = n;
        }
    }
    const s = await FinanceSettings.findOneAndUpdate({ org: user.id }, { $set: set }, { upsert: true, new: true });
    return NextResponse.json(toDTO(s));
}
