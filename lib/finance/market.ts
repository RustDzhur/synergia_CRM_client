// Режим рынка фирмы: DE или UA. Страна в FinanceSettings.country определяет, что фирма видит и какие
// функции работают — интерфейс, документы, налоги и интеграции выбираются по режиму целиком.
// Смешивать нельзя: у украинской фирмы не должно быть немецких вкладок и кнопок и наоборот.
//
// Это единственный источник правды: и сервер (requireMarket в lib/finance/marketGuard.ts), и клиент
// (useMarket) берут список вкладок, документов, интеграций и налоговых модулей отсюда, а не из
// проверок country === "UA" по месту. Модуль чистый (без mongoose и React) — его можно импортировать
// и в браузере, и на сервере.

export type Market = "DE" | "UA";

/** Страна → режим рынка. Пусто/неизвестно → null: фирма ещё не выбрала страну (экран выбора). */
export function marketOf(country?: string | null): Market | null {
    const c = String(country ?? "").trim().toUpperCase();
    if (c === "DE") return "DE";
    if (c === "UA") return "UA";
    return null;
}

/** Язык документов фирмы по стране: украинская — украинский, немецкая — немецкий. Пусто — null.
 *  По нему выбирается язык PDF и письма клиенту, когда язык не задан явно: документ должен быть
 *  на языке страны, в которой он выставляется, — интерфейс кабинета может быть и на третьем. */
export const marketDocumentLocale = (country?: string | null): "ua" | "de" | null => {
    const m = marketOf(country);
    return m === "UA" ? "ua" : m === "DE" ? "de" : null;
};

/** Вкладки финансового раздела (ключи совпадают с Finance/index.tsx и ?tab= в ссылках). */
export type FinanceTabId =
    | "overview"
    | "quotes"
    | "orders"
    | "contracts"
    | "acts"
    | "deliveryNotes"
    | "invoices"
    | "recurring"
    | "dunning"
    | "expenses"
    | "assets"
    | "bank"
    | "products"
    | "delivery"
    | "fiscal"
    | "vat"
    | "eur"
    | "bwa"
    | "susa"
    | "audit"
    | "settings";

/** Виды документов, которые выпускает режим (см. lib/finance/pdf.ts, DocKind). */
export type MarketDocumentKind =
    | "invoice"
    | "quote"
    | "order"
    | "contract"
    | "credit_note"
    | "delivery_note"
    | "act"
    | "tax_invoice"
    | "correction_invoice"
    | "fiscal_receipt";

/** Интеграции, которые разрешены/показываются только своему рынку (общие — Telegram, почта и т.п. — видны всегда). */
export type MarketIntegrationType =
    | "novaposhta"
    | "ukrposhta"
    | "checkbox"
    | "monobank"
    | "liqpay"
    | "wayforpay"
    | "cryptopay"
    | "prom"
    | "rozetka"
    | "horoshop"
    | "olx"
    | "nbu";

/** Налоговые модули (экраны отчётов и налогов). */
export type TaxModule =
    | "ustva" // DE: Umsatzsteuer-Voranmeldung (UStVA)
    | "eur" // DE: Einnahmen-Überschuss-Rechnung
    | "bwa" // DE: BWA
    | "susa" // DE: Summen- und Saldenliste
    | "ua_vat_register" // UA: реєстр податкових накладних
    | "ua_income_book" // UA: книга обліку доходів (ФОП) / доходи ТОВ
    | "ua_profit_tax"; // UA: податок на прибуток (ТОВ на загальній системі)

export interface MarketProfile {
    market: Market;
    currencyDefault: "EUR" | "UAH";
    localeDefault: "de" | "ua";
    nav: FinanceTabId[];
    documents: MarketDocumentKind[];
    integrations: MarketIntegrationType[];
    taxModules: TaxModule[];
    features: {
        dunning: boolean; // Mahnwesen — только DE
        assets: boolean; // Anlagen — только DE
        sepaQr: boolean; // SEPA/EPC-QR в счетах — только DE
        deliveryNote: boolean; // Lieferschein / видаткова накладна — в обоих, но подписи разные
        act: boolean; // акт виконаних робіт — только UA
        fiscal: boolean; // ПРРО/фискальный чек — только UA
        delivery: boolean; // доставка (НП/Укрпошта) — только UA
        paymentLinks: boolean; // ссылки на оплату через украинские эквайринги — только UA
        marketplace: boolean; // Prom/Rozetka/Horoshop/OLX — только UA
        nbuRate: boolean; // фиксация курса НБУ в документе — только UA
        smallBusiness: boolean; // Kleinunternehmerregelung §19 — только DE
    };
}

const DE: MarketProfile = {
    market: "DE",
    currencyDefault: "EUR",
    localeDefault: "de",
    // Порядок совпадает с NAV в Finance/index.tsx: огляд → документы → деньги → отчёты → настройки
    nav: ["overview", "quotes", "orders", "contracts", "invoices", "recurring", "dunning", "expenses", "assets", "bank", "products", "vat", "eur", "bwa", "susa", "settings", "audit"],
    documents: ["invoice", "quote", "order", "contract", "credit_note", "delivery_note"],
    integrations: [],
    taxModules: ["ustva", "eur", "bwa", "susa"],
    features: {
        dunning: true,
        assets: true,
        sepaQr: true,
        deliveryNote: true,
        act: false,
        fiscal: false,
        delivery: false,
        paymentLinks: false,
        marketplace: false,
        nbuRate: false,
        smallBusiness: true,
    },
};

const UA: MarketProfile = {
    market: "UA",
    currencyDefault: "UAH",
    localeDefault: "ua",
    // Огляд · замовлення · рахунки · договори · акти · накладні · регулярні рахунки · витрати · банк ·
    // товари/склад · доставка (НП/Укрпошта) · ПРРО (чеки/зміни) · податки · аудит · налаштування
    nav: ["overview", "quotes", "orders", "contracts", "acts", "deliveryNotes", "invoices", "recurring", "expenses", "bank", "products", "delivery", "fiscal", "vat", "eur", "audit", "settings"],
    documents: ["invoice", "quote", "order", "contract", "credit_note", "delivery_note", "act", "tax_invoice", "correction_invoice", "fiscal_receipt"],
    integrations: ["novaposhta", "ukrposhta", "checkbox", "monobank", "liqpay", "wayforpay", "cryptopay", "prom", "rozetka", "horoshop", "olx", "nbu"],
    taxModules: ["ua_vat_register", "ua_income_book", "ua_profit_tax"],
    features: {
        dunning: false,
        assets: false,
        sepaQr: false,
        deliveryNote: true,
        act: true,
        fiscal: true,
        delivery: true,
        paymentLinks: true,
        marketplace: true,
        nbuRate: true,
        smallBusiness: false,
    },
};

/** Профиль режима рынка. Для неизвестного/пустого режима — null (экран выбора страны). */
export function profile(market: Market): MarketProfile {
    return market === "UA" ? UA : DE;
}

export function marketProfileOf(country?: string | null): MarketProfile | null {
    const m = marketOf(country);
    return m ? profile(m) : null;
}

/** Доступен ли документ в режиме (для кнопок «создать» и проверок на сервере). */
export function marketHasDocument(country: string | null | undefined, kind: MarketDocumentKind): boolean {
    const p = marketProfileOf(country);
    return !!p && p.documents.includes(kind);
}

/** Разрешена ли интеграция в режиме: общие (не перечисленные в профилях) — всегда, свои — только своему рынку. */
export function marketAllowsIntegration(country: string | null | undefined, type: string): boolean {
    const p = marketProfileOf(country);
    if (!p) return false;
    const own = [...DE.integrations, ...UA.integrations];
    if (!own.includes(type as MarketIntegrationType)) return true; // общая — не зависит от режима
    return p.integrations.includes(type as MarketIntegrationType);
}

/** Набор по умолчанию при смене страны: валюта, префиксы, срок оплаты, шаблон и налоговые ставки. */
export interface MarketDefaults {
    currency: string;
    invoicePrefix: string;
    quotePrefix: string;
    creditNotePrefix: string;
    deliveryNotePrefix: string;
    actPrefix: string;
    packingPrefix: string;
    paymentTermsDays: number;
    smallBusiness: boolean;
    uaVatPayer: boolean;
}

export const MARKET_DEFAULTS: Record<Market, MarketDefaults> = {
    DE: { currency: "EUR", invoicePrefix: "RE", quotePrefix: "AN", creditNotePrefix: "GS", deliveryNotePrefix: "LS", actPrefix: "АКТ", packingPrefix: "PL", paymentTermsDays: 14, smallBusiness: false, uaVatPayer: false },
    UA: { currency: "UAH", invoicePrefix: "РАХ", quotePrefix: "КП", creditNotePrefix: "КН", deliveryNotePrefix: "ВН", actPrefix: "АКТ", packingPrefix: "ПЛ", paymentTermsDays: 5, smallBusiness: false, uaVatPayer: false },
};

/** Что скроется/появится при смене страны — для окна подтверждения в интерфейсе. */
export function marketDiff(from: Market, to: Market): { hidden: FinanceTabId[]; shown: FinanceTabId[] } {
    const a = profile(from).nav;
    const b = profile(to).nav;
    return { hidden: a.filter((t) => !b.includes(t)), shown: b.filter((t) => !a.includes(t)) };
}
