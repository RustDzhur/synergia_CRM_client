// Правила украинского учёта с датой актуальности.
//
// Ставки, лимиты и сборы пересматриваются законами каждый год, поэтому они не константы кода:
// здесь лежит **справочный набор по годам** (умолчание и источник), а фирма может переопределить
// лимиты групп своими значениями в настройках (uaLimits) — по ним и считаются отчёты.
// В интерфейсе всегда видно, на какой год действуют цифры, и просьба сверить их с бухгалтером:
// это не налоговая консультация.
//
// Этот файл — чистая арифметика и справочные числа; ничего не читает из базы.

export interface UaYearRules {
    year: number;
    /** Период действия набора — те же границы, что у года: по ним видно, что набор не «вечный» */
    validFrom: string;
    validTo: string;
    /** Лимиты дохода по группам єдиного податку, ₴ за год (4-я группа — сільгоспвиробники, лимит считается от площади) */
    groupLimits: Record<number, number>;
    /** ЄСВ за себя в месяц (22 % от минимальной зарплаты), ₴ */
    esvMonthly: number;
    /** Военный сбор 3-й группы, % от дохода */
    militaryRate: number;
    /** Военный сбор 1, 2 и 4 групп, ₴ в месяц */
    militaryFixed: number;
    /** Порог обязательной регистрации плательщиком ПДВ (оборот за 12 месяцев), ₴ */
    vatLimit: number;
    /** Ставки єдиного податку 3-й группы: с ПДВ и без ПДВ, % */
    singleRates: { withVat: number; withoutVat: number };
    /** Ставка единого налога при превышении лимита группы, % */
    overLimitRate: number;
    source: string;
}

// 2025 — действующие значения (ПКУ и законы о госбюджете; перед подачей отчётности сверяет бухгалтер).
// 2026 — переносится тем же набором: официальных изменений в справочнике нет, поэтому год помечен
// как «предварительно» и в интерфейсе видно, на какой год фирма смотрит цифры.
export const UA_RULES: UaYearRules[] = [
    {
        year: 2025,
        validFrom: "2025-01-01",
        validTo: "2025-12-31",
        groupLimits: { 1: 1_336_000, 2: 6_672_000, 3: 9_336_000 },
        esvMonthly: 1760,
        militaryRate: 1,
        militaryFixed: 800,
        vatLimit: 1_000_000,
        singleRates: { withVat: 3, withoutVat: 5 },
        overLimitRate: 15,
        source: "ПКУ та закони на 2025 рік",
    },
    {
        year: 2026,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        groupLimits: { 1: 1_336_000, 2: 6_672_000, 3: 9_336_000 },
        esvMonthly: 1760,
        militaryRate: 1,
        militaryFixed: 800,
        vatLimit: 1_000_000,
        singleRates: { withVat: 3, withoutVat: 5 },
        overLimitRate: 15,
        source: "перенесено з 2025 року — перевірте зміни на 2026",
    },
];

/** Правила на год: точное совпадение, иначе ближайший прошлый (с честной пометкой в source). */
export function rulesFor(year: number): UaYearRules {
    const exact = UA_RULES.find((r) => r.year === year);
    if (exact) return exact;
    const past = UA_RULES.filter((r) => r.year < year).sort((a, b) => b.year - a.year)[0];
    const base = past ?? UA_RULES[0];
    return { ...base, year, validFrom: `${year}-01-01`, validTo: `${year}-12-31`, source: `${base.source}; для ${year} року правил ще немає в довіднику — перевірте з бухгалтером` };
}

/** Настройки фирмы, влияющие на расчёт (подмножество FinanceSettings). */
export interface UaLimitSetting {
    year: number;
    group: number;
    amount: number;
}

/**
 * Лимит группы на год: фирма могла задать своё значение (uaLimits) — оно важнее справочного.
 * Нет ни того, ни другого (4-я группа) — null: лимит считается от площади, а не от дохода.
 */
export function groupLimit(settings: { uaLimits?: UaLimitSetting[] }, year: number, group: number): number | null {
    const own = (settings.uaLimits ?? []).find((l) => Number(l.year) === year && Number(l.group) === group);
    if (own && Number(own.amount) > 0) return Number(own.amount);
    const fallback = rulesFor(year).groupLimits[group];
    return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

/** Набор лимитов на год для интерфейса: справочные значения с заменой на фирменные. */
export function limitsForYear(settings: { uaLimits?: UaLimitSetting[] }, year: number): Array<{ group: number; amount: number; own: boolean }> {
    const rules = rulesFor(year);
    return [1, 2, 3, 4].map((group) => {
        const own = (settings.uaLimits ?? []).find((l) => Number(l.year) === year && Number(l.group) === group);
        const amount = own && Number(own.amount) > 0 ? Number(own.amount) : (rules.groupLimits[group] ?? 0);
        return { group, amount, own: !!(own && Number(own.amount) > 0) };
    });
}

/** Строка для интерфейса: «Правила на 2026; сверьтесь с бухгалтером». */
export function rulesNotice(year: number): string {
    return `Правила на ${year}; сверьтесь с бухгалтером`;
}
