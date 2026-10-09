import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { COUNTRY_CODES, COUNTRY_TAX } from "@/lib/finance/taxRates";
import { MARKET_DEFAULTS, marketOf } from "@/lib/finance/market";
import { mergeUz, emptyUz, type UzProfile } from "@/lib/validation/uz";
import { UA_TAX_SYSTEMS, taxSystemOf, uaProfileErrors, formAndGroup } from "@/lib/validation/ua";
import { financeSettings } from "@/lib/finance/settings";
import { isTemplate } from "@/lib/finance/pdf";
import { parseCategories } from "@/lib/finance/expenseCategories";
import { cleanExtra, mergeExtra } from "@/lib/finance/contractFields";
import { prisma } from "@/lib/prisma";

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
        uaLegalForm: s.uaLegalForm === "tov" ? "tov" : s.uaLegalForm === "other" ? "other" : "fop",
        uaTaxSystem: taxSystemOf(s),
        uaGroup: [0, 1, 2, 3, 4].includes(Number(s.uaGroup)) ? Number(s.uaGroup) : 3,
        uaSingleRate: Number(s.uaSingleRate) === 3 ? 3 : 5,
        uaVatPayer: !!s.uaVatPayer,
        uaVatRegDate: s.uaVatRegDate ?? "",
        uaVatCertificate: s.uaVatCertificate ?? "",
        uaVatRates: Array.isArray(s.uaVatRates) && s.uaVatRates.length ? s.uaVatRates.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n)) : [20, 7, 0],
        uaEdrpou: s.uaEdrpou ?? "",
        uaIpn: s.uaIpn ?? "",
        uaKved: Array.isArray(s.uaKved) ? s.uaKved.map((x: unknown) => String(x)).slice(0, 50) : [],
        uaBank: s.uaBank ?? "",
        uaIban: s.uaIban ?? "",
        uaMfo: s.uaMfo ?? "",
        uaSignerName: s.uaSignerName ?? "",
        uaSignerPosition: s.uaSignerPosition ?? "",
        uaSignature: s.uaSignature ?? "",
        uaSeal: s.uaSeal ?? "",
        uaLimits: Array.isArray(s.uaLimits)
            ? s.uaLimits.map((l: { year?: unknown; group?: unknown; amount?: unknown }) => ({ year: Number(l.year) || 0, group: Number(l.group) || 0, amount: Number(l.amount) || 0 })).filter((l: { year: number }) => l.year > 2000)
            : [],
        uaEsvMonthly: Number(s.uaEsvMonthly) || 1760,
        uaMilitaryRate: Number.isFinite(Number(s.uaMilitaryRate)) ? Number(s.uaMilitaryRate) : 1,
        uaMilitaryFixed: Number.isFinite(Number(s.uaMilitaryFixed)) ? Number(s.uaMilitaryFixed) : 800,
        uaVatLimit: Number(s.uaVatLimit) || 1000000,
        uaVatPeriod: s.uaVatPeriod === "quarter" ? "quarter" : "month",
        // Реквизиты рынка UZ: объект целиком (пустые строки, если фирма ещё ничего не заполнила)
        uz: { ...emptyUz(), ...((s.uz && typeof s.uz === "object" ? s.uz : {}) as Partial<UzProfile>) },
        rateMargin: Number(s.rateMargin) || 0,
        template: isTemplate(s.template) ? s.template : "classic",
        paymentQr: s.paymentQr !== false,
        // Справочник категорий расходов: пусто — интерфейс предлагает типовой набор страны
        expenseCategories: parseCategories(s.expenseCategories),
        // Типовой текст договора фирмы (подстановки {{…}} заполняет PDF); пусто — встроенный типовой
        contractTemplate: s.contractTemplate ?? "",
        // реквизиты фирмы для договоров, которых нет в настройках (должность и основание подписанта, регистрационные номера, банковские коды…)
        contractData: s.contractData && typeof s.contractData === "object" ? s.contractData : {},
    };
}

// GET /api/finance/settings — настройки фирмы + справочник стран со ставками (для выпадающего списка в интерфейсе)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const s = await financeSettings(user.id);
    return NextResponse.json({ settings: toDTO(s), countries: COUNTRY_CODES.map((code) => ({ code, ...COUNTRY_TAX[code] })) });
}

// PATCH /api/finance/settings — обновить (владелец/администратор — модуль inventory уже это требует для не-GET)
export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    let set: Record<string, unknown> = {};
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
    // Украинская налоговая модель: набор и границы проверяем здесь, чтобы в документ не попало что угодно.
    // Реквизиты (ЄДРПОУ, ІПН, IBAN, МФО, КВЕД, свідоцтво ПДВ) проходят валидаторы lib/validation/ua.ts.
    // Невалидные поля НЕ сохраняем, но и не отклоняем всю форму из-за одного из них: раньше PATCH отвечал
    // 400 целиком, из-за чего при одной опечатке терялось всё введённое, а на экране оставались значения —
    // выглядело как «сохранилось, но после обновления пропало». Ошибки уходят кодами в ответе.
    const uaErrors = uaProfileErrors(b as Record<string, unknown>);
    if (b.uaLegalForm === "fop" || b.uaLegalForm === "tov" || b.uaLegalForm === "other") set.uaLegalForm = b.uaLegalForm;
    if ((UA_TAX_SYSTEMS as readonly string[]).includes(String(b.uaTaxSystem))) {
        // Система налогообложения ведёт за собой форму и группу — они не могут расходиться
        const system = String(b.uaTaxSystem) as (typeof UA_TAX_SYSTEMS)[number];
        const { legalForm, group } = formAndGroup(system, Number(b.uaSingleRate) === 3 ? 3 : 5);
        set.uaTaxSystem = system;
        set.uaLegalForm = legalForm;
        set.uaGroup = group;
    }
    if ([0, 1, 2, 3, 4].includes(Number(b.uaGroup))) set.uaGroup = Number(b.uaGroup);
    if (Number(b.uaSingleRate) === 3 || Number(b.uaSingleRate) === 5) set.uaSingleRate = Number(b.uaSingleRate);
    if (typeof b.uaVatPayer === "boolean") set.uaVatPayer = b.uaVatPayer;
    if (b.uaVatPeriod === "month" || b.uaVatPeriod === "quarter") set.uaVatPeriod = b.uaVatPeriod;
    if (typeof b.uaVatRegDate === "string") set.uaVatRegDate = /^\d{4}-\d{2}-\d{2}$/.test(b.uaVatRegDate) ? b.uaVatRegDate : "";
    if (Array.isArray(b.uaVatRates)) {
        const allowed = [20, 7, 0];
        set.uaVatRates = b.uaVatRates.map((n: unknown) => Number(n)).filter((n: number) => allowed.includes(n));
    }
    // КВЕД: запятая вместо точки («62,01») — частая опечатка, нормализуем её при сохранении
    if (Array.isArray(b.uaKved)) set.uaKved = b.uaKved.map((x: unknown) => String(x).trim().replace(/,/g, ".")).filter(Boolean).slice(0, 50);
    // Лимиты групп по годам: 2000..2100, группы 1..4, суммы неотрицательные
    if (Array.isArray(b.uaLimits)) {
        set.uaLimits = b.uaLimits
            .map((l: { year?: unknown; group?: unknown; amount?: unknown }) => ({ year: Math.round(Number(l.year) || 0), group: Math.round(Number(l.group) || 0), amount: Math.max(0, Number(l.amount) || 0) }))
            .filter((l: { year: number; group: number }) => l.year >= 2000 && l.year <= 2100 && l.group >= 1 && l.group <= 4)
            .slice(0, 40);
    }
    // Подпись и печать приходят data-URL из того же ресайза, что логотип: только картинка и не больше 400 КБ
    for (const k of ["uaSignature", "uaSeal"] as const) {
        if (typeof b[k] === "string") set[k] = String(b[k]).startsWith("data:image/") && String(b[k]).length <= 400_000 ? b[k] : "";
    }
    for (const k of ["uaEdrpou", "uaIpn", "uaVatCertificate", "uaBank", "uaIban", "uaMfo", "uaSignerName", "uaSignerPosition"] as const) {
        const v = str(b[k], 100);
        if (v !== undefined) set[k] = k === "uaIban" ? v.replace(/\s/g, "").toUpperCase() : v;
    }
    if (b.rateMargin !== undefined) {
        const n = Number(b.rateMargin);
        if (Number.isFinite(n) && n >= 0 && n <= 50) set.rateMargin = n;
    }
    // Категории расходов: фирма ведёт список сама (пустой массив — вернуться к типовым подсказкам)
    if (Array.isArray(b.expenseCategories)) set.expenseCategories = parseCategories(b.expenseCategories);
    // Типовой текст договора: длинный текст, ограничение только по размеру поля
    if (typeof b.contractTemplate === "string") set.contractTemplate = b.contractTemplate.trim().slice(0, 20000);
    if (b.contractData && typeof b.contractData === "object") {
        const cur = await prisma.financeSettings.findUnique({ where: { org: user.id }, select: { contractData: true } });
        set.contractData = mergeExtra(cur?.contractData, cleanExtra(b.contractData));
    }
    for (const [key, max] of [["uaEsvMonthly", 100000], ["uaMilitaryFixed", 100000], ["uaVatLimit", 100000000], ["uaMilitaryRate", 100]] as const) {
        if (b[key] !== undefined) {
            const n = Number(b[key]);
            if (Number.isFinite(n) && n >= 0 && n <= max) set[key] = n;
        }
    }
    // Реквизиты Узбекистана: те же правила, что для UA — поле с ошибкой формата не сохраняется, остальное сохраняется
    let uzErrors: { field: string; code: string }[] = [];
    if (b.uz && typeof b.uz === "object") {
        const cur = await prisma.financeSettings.findUnique({ where: { org: user.id }, select: { uz: true } });
        const merged = mergeUz(cur?.uz as Partial<UzProfile> | null, b.uz);
        set.uz = merged.value;
        uzErrors = merged.errors.map((e) => ({ field: `uz.${e.field}`, code: e.code }));
    }
    // Поля с неверными реквизитами не сохраняем — остальную форму сохраняем целиком
    for (const issue of uaErrors) delete set[issue.field];
    // Смена режима рынка может применить набор по умолчанию (валюта, префиксы, срок оплаты, шаблон,
    // налоговые прапорщики): явно присланные поля сильнее набора, существующие документы не трогаются
    if (b.applyDefaults === true) {
        const current = typeof set.country === "string" ? null : await prisma.financeSettings.findUnique({ where: { org: user.id }, select: { country: true } });
        const target = marketOf(typeof set.country === "string" ? set.country : current?.country);
        if (target) set = { ...MARKET_DEFAULTS[target], ...set };
    }
    // org уникален: upsert заменяет прежний findOneAndUpdate с upsert
    const s = await prisma.financeSettings.upsert({
        where: { org: user.id },
        create: { org: user.id, ...(set as any) },
        update: set as any,
    });
    return NextResponse.json({ ...toDTO(s), fieldErrors: [...uaErrors, ...uzErrors] });
}
