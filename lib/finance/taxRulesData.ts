// Налоговые правила рынка как ДАННЫЕ с датами действия, источником и отметкой проверки (docs/TZ_MASTER.md §4.2, п. 3).
// Этот файл чистый (без базы): начальные записи и выбор правила на дату можно импортировать и в браузере, и в тестах.
// Расчёт документа берёт правило, действовавшее на дату документа; закон изменился — добавляется запись, код не трогается.
// Пока у записи нет verifiedBy, интерфейс показывает «правила не проверены специалистом Узбекистана».

export interface TaxRuleRow {
    market: string; code: string; title: Record<string, string>; rate: number | null; params: Record<string, unknown>;
    validFrom: string; validTo: string | null; source: string; sourceUrl: string; note: string; verifiedBy: string | null;
}

const EY = "https://www.ey.com/en_uz/technical/tax-alerts/2026/06/fmcg-tax-digest-uzbekistan-may-2026-tax-changes";
const GAZETA = "https://www.gazeta.uz/en/2026/05/29/busine/";
const BIZREG = "https://www.bizreg.uz/en/blog/nds-v-uzbekistane";

// Начальные записи по источникам из docs/TZ_UZBEKISTAN_AND_ROBOTS.md (раздел 12). Все — verifiedBy: null.
export const UZ_SEED: TaxRuleRow[] = [
    { market: "UZ", code: "vat_standard", title: { en: "VAT, standard rate", ru: "НДС, общая ставка", uz: "QQS, umumiy stavka" }, rate: 12, params: {}, validFrom: "2026-01-01", validTo: null,
      source: "EY Uzbekistan Tax Alert (июнь 2026); bizreg.uz", sourceUrl: EY, note: "Ставка 12 % подтверждена источниками на 2026 год; дата начала действия ставки и срок (источник называет стабильность до 1 января 2028, УП-229) требуют проверки по тексту закона.", verifiedBy: null },
    { market: "UZ", code: "vat_simplified", title: { en: "Voluntary simplified VAT 6 %", ru: "Добровольный упрощённый НДС 6 %", uz: "Ixtiyoriy soddalashtirilgan QQS 6 %" }, rate: 6,
      params: { voluntary: true, inputVatCredit: false, sectors: ["trade", "catering", "services"] }, validFrom: "2026-06-01", validTo: "2029-12-31",
      source: "EY Uzbekistan Tax Alert (июнь 2026); Gazeta.uz 29.05.2026", sourceUrl: GAZETA, note: "С 1 июня 2026 по 1 января 2030; торговля, общепит, услуги; без права зачёта входного НДС. Условия применения проверить.", verifiedBy: null },
    { market: "UZ", code: "vat_export", title: { en: "VAT on export", ru: "НДС при экспорте", uz: "Eksportda QQS" }, rate: 0, params: {}, validFrom: "2026-01-01", validTo: null,
      source: "bizreg.uz (вторичный источник)", sourceUrl: BIZREG, note: "Нулевая ставка при экспорте; подтверждающие документы и условия проверить.", verifiedBy: null },
    { market: "UZ", code: "vat_registration_threshold", title: { en: "Mandatory VAT registration threshold", ru: "Порог обязательной регистрации плательщиком НДС", uz: "QQS to‘lovchisi sifatida majburiy ro‘yxatdan o‘tish chegarasi" }, rate: null,
      params: { soum: 1_000_000_000 }, validFrom: "2019-01-01", validTo: "2026-05-31", source: "EY Uzbekistan Tax Alert (июнь 2026)", sourceUrl: EY, note: "Прежний порог — 1 млрд сумов. Дата начала действия не подтверждена.", verifiedBy: null },
    { market: "UZ", code: "vat_registration_threshold", title: { en: "Mandatory VAT registration threshold", ru: "Порог обязательной регистрации плательщиком НДС", uz: "QQS to‘lovchisi sifatida majburiy ro‘yxatdan o‘tish chegarasi" }, rate: null,
      params: { brv: 12000, soum: 5_000_000_000 }, validFrom: "2026-06-01", validTo: null, source: "EY Uzbekistan Tax Alert (июнь 2026); Gazeta.uz", sourceUrl: EY, note: "С 1 июня 2026: 12 000 БРВ, ≈ 5 млрд сумов (источники расходятся в единицах и точной сумме).", verifiedBy: null },
    { market: "UZ", code: "profit_tax", title: { en: "Corporate profit tax", ru: "Налог на прибыль юридических лиц", uz: "Yuridik shaxslar foyda solig‘i" }, rate: 15, params: {}, validFrom: "2026-01-01", validTo: null,
      source: "bizreg.uz (вторичный источник)", sourceUrl: BIZREG, note: "Общая ставка; льготные ставки и условия не загружены.", verifiedBy: null },
    { market: "UZ", code: "turnover_tax", title: { en: "Turnover tax (legal entities)", ru: "Налог с оборота (юрлица)", uz: "Aylanmadan soliq (yuridik shaxslar)" }, rate: 4, params: { appliesTo: "legal_entities" }, validFrom: "2026-01-01", validTo: null,
      source: "вторичные источники", sourceUrl: BIZREG, note: "Ставка 4 % — по вторичным источникам; условия применения проверить.", verifiedBy: null },
    { market: "UZ", code: "turnover_tax_micro", title: { en: "Turnover tax (sole proprietors, self-employed)", ru: "Налог с оборота (ИП, самозанятые до 1 млрд сумов)", uz: "Aylanmadan soliq (YaTT, o‘z-o‘zini band qilganlar)" }, rate: 1, params: { appliesTo: "sole_proprietors", turnoverLimitSoum: 1_000_000_000 }, validFrom: "2026-01-01", validTo: null,
      source: "вторичные источники", sourceUrl: BIZREG, note: "Ставка 1 % при обороте до 1 млрд сумов — по вторичным источникам; условия проверить.", verifiedBy: null },
];

export interface RuleMatch { rule: TaxRuleRow; exact: boolean }

/** Правило кода на дату (YYYY-MM-DD). Если ни одно не действовало на эту дату — ближайшее по времени с exact: false: вызывающий показывает предупреждение, а не молчит. */
export function pickRule(rules: TaxRuleRow[], code: string, date: string): RuleMatch | null {
    const list = rules.filter((r) => r.code === code).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    if (!list.length) return null;
    const hit = list.filter((r) => r.validFrom <= date && (!r.validTo || date <= r.validTo)).pop();
    if (hit) return { rule: hit, exact: true };
    const before = list.filter((r) => r.validFrom <= date).pop();
    return { rule: before ?? list[0], exact: false };
}

