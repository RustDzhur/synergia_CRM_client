// Режим рынка фирмы: DE или UA. Страна в FinanceSettings.country определяет, что фирма видит и какие
// функции работают — интерфейс, документы, налоги и интеграции выбираются по режиму целиком.
// Смешивать нельзя: у украинской фирмы не должно быть немецких вкладок и кнопок и наоборот.
//
// Это единственный источник правды: и сервер (requireMarket в lib/finance/marketGuard.ts), и клиент
// (useMarket) берут список вкладок, документов, интеграций и налоговых модулей отсюда, а не из
// проверок country === "UA" по месту. Модуль чистый (без mongoose и React) — его можно импортировать
// и в браузере, и на сервере.

// Рынок — код страны (ISO 3166-1 alpha-2), профиль которой зарегистрирован в реестре ниже (registerMarket).
// Новый рынок добавляется регистрацией профиля, а не правкой проверок по месту.
export type Market = string;

const REGISTRY = new Map<Market, MarketProfile>();

/** Регистрирует профиль рынка (данные: валюта, язык документов, вкладки, документы, интеграции, налоговые модули). */
export function registerMarket(p: MarketProfile): void {
    REGISTRY.set(p.market.toUpperCase(), p);
}

/** Коды зарегистрированных рынков в порядке регистрации. */
export const registeredMarkets = (): Market[] => Array.from(REGISTRY.keys());

/** Страна → режим рынка. Пусто/неизвестно/не зарегистрирован → null: фирма ещё не выбрала страну (экран выбора). */
export function marketOf(country?: string | null): Market | null {
    const c = String(country ?? "").trim().toUpperCase();
    return REGISTRY.has(c) ? c : null;
}

/** Язык документов фирмы по стране: украинская — украинский, немецкая — немецкий. Пусто — null.
 *  По нему выбирается язык PDF и письма клиенту, когда язык не задан явно: документ должен быть
 *  на языке страны, в которой он выставляется, — интерфейс кабинета может быть и на третьем. */
export const marketDocumentLocale = (country?: string | null): DocLocale | null => marketProfileOf(country)?.localeDefault ?? null;

/** Вкладки финансового раздела (ключи совпадают с Finance/index.tsx и ?tab= в ссылках). */
export type FinanceTabId =
    | "overview"
    | "esf"
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
    | "nbu"
    | "cbu"; // курсы Центрального банка Узбекистана

/** Налоговые модули (экраны отчётов и налогов). */
export type TaxModule =
    | "ustva" // DE: Umsatzsteuer-Voranmeldung (UStVA)
    | "eur" // DE: Einnahmen-Überschuss-Rechnung
    | "bwa" // DE: BWA
    | "susa" // DE: Summen- und Saldenliste
    | "ua_vat_register" // UA: реєстр податкових накладних
    | "ua_income_book" // UA: книга обліку доходів (ФОП) / доходи ТОВ
    | "ua_profit_tax" // UA: податок на прибуток (ТОВ на загальній системі)
    | "uz_vat" // UZ: QQS (НДС) по правилам на дату документа
    | "uz_esf_register"; // UZ: журналы выданных и полученных счетов-фактур (ЭСФ)

export type DocLocale = "de" | "ua" | "en" | "uz";

export interface MarketProfile {
    market: Market;
    /** Название страны в родительном падеже для сообщений «Функция доступна только для …» */
    nameGenitive: string;
    currencyDefault: string;
    localeDefault: DocLocale;
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
        cbuRate: boolean; // фиксация курса ЦБ Узбекистана в документе — только UZ
        esf: boolean; // электронные счета-фактуры (подготовка данных и журналы) — только UZ
        smallBusiness: boolean; // Kleinunternehmerregelung §19 — только DE
    };
}

const DE: MarketProfile = {
    market: "DE",
    nameGenitive: "Германии",
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
        cbuRate: false,
        esf: false,
        smallBusiness: true,
    },
};

const UA: MarketProfile = {
    market: "UA",
    nameGenitive: "Украины",
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
        cbuRate: false,
        esf: false,
        smallBusiness: false,
    },
};

// Узбекистан, версия 1 (бета): документы готовятся на узбекском и русском, ЭСФ/ЭТТН — данные и журналы без отправки оператору
// (docs/TZ_MASTER.md §4.2). Налоговые правила лежат в таблице TaxRule с датами действия и источниками, а не в коде.
const UZ: MarketProfile = {
    market: "UZ",
    nameGenitive: "Узбекистана",
    currencyDefault: "UZS",
    localeDefault: "uz",
    nav: ["overview", "quotes", "orders", "contracts", "acts", "deliveryNotes", "invoices", "recurring", "expenses", "bank", "products", "vat", "audit", "settings"],
    documents: ["invoice", "quote", "order", "contract", "credit_note", "delivery_note", "act", "tax_invoice"],
    integrations: ["cbu"],
    taxModules: ["uz_vat", "uz_esf_register"],
    features: {
        dunning: false,
        assets: false,
        sepaQr: false,
        deliveryNote: true,
        act: true,
        fiscal: false,
        delivery: false,
        paymentLinks: false,
        marketplace: false,
        nbuRate: false,
        cbuRate: true,
        esf: true,
        smallBusiness: false,
    },
};

registerMarket(DE);
registerMarket(UA);
registerMarket(UZ);

/** Профиль режима рынка. Рынок обязан быть зарегистрирован (marketOf возвращает только такие). */
export function profile(market: Market): MarketProfile {
    const p = REGISTRY.get(String(market).toUpperCase());
    if (!p) throw new Error(`Рынок не зарегистрирован: ${market}`);
    return p;
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

/** Относится ли интеграция только к одному из рынков (Германия или Украина): общие — звонки, мессенджеры, веб-чат — к рынку не привязаны. */
const ownIntegrations = (): MarketIntegrationType[] => Array.from(REGISTRY.values()).flatMap((p) => p.integrations);
export const isMarketSpecificIntegration = (type: string): boolean => ownIntegrations().includes(type as MarketIntegrationType);

/** Разрешена ли интеграция в режиме: общие (не перечисленные в профилях) — всегда, свои — только своему рынку. */
export function marketAllowsIntegration(country: string | null | undefined, type: string): boolean {
    const p = marketProfileOf(country);
    if (!p) return false;
    if (!isMarketSpecificIntegration(type)) return true; // общая — не зависит от режима
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
    UZ: { currency: "UZS", invoicePrefix: "HF", quotePrefix: "TT", creditNotePrefix: "KN", deliveryNotePrefix: "YX", actPrefix: "DL", packingPrefix: "QV", paymentTermsDays: 5, smallBusiness: false, uaVatPayer: false },
};

/** Что скроется/появится при смене страны — для окна подтверждения в интерфейсе. */
export function marketDiff(from: Market, to: Market): { hidden: FinanceTabId[]; shown: FinanceTabId[] } {
    const a = profile(from).nav;
    const b = profile(to).nav;
    return { hidden: a.filter((t) => !b.includes(t)), shown: b.filter((t) => !a.includes(t)) };
}
