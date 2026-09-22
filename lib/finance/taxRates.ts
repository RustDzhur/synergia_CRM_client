// Ставки НДС/налога с продаж по странам — только чтобы подставить разумное значение по умолчанию, когда фирма выбрала
// свою страну (FinanceSettings.country). Ставку на конкретном счёте всегда можно изменить вручную. Это не налоговая
// консультация: ставки время от времени меняются, окончательную корректность должен проверять бухгалтер/налоговый консультант.
export interface CountryTax {
    name: string;
    standard: number; // стандартная ставка, %
    reduced?: number; // пониженная ставка, %
    superReduced?: number; // сверхпониженная (где есть)
    label: string; // как называть налог в интерфейсе — «VAT», «USt.», «ПДВ»...
}

export const COUNTRY_TAX: Record<string, CountryTax> = {
    DE: { name: "Germany", standard: 19, reduced: 7, label: "USt." },
    AT: { name: "Austria", standard: 20, reduced: 10, label: "USt." },
    CH: { name: "Switzerland", standard: 8.1, reduced: 2.6, label: "MWST" },
    FR: { name: "France", standard: 20, reduced: 5.5, superReduced: 2.1, label: "TVA" },
    IT: { name: "Italy", standard: 22, reduced: 10, superReduced: 4, label: "IVA" },
    ES: { name: "Spain", standard: 21, reduced: 10, superReduced: 4, label: "IVA" },
    NL: { name: "Netherlands", standard: 21, reduced: 9, label: "BTW" },
    BE: { name: "Belgium", standard: 21, reduced: 6, label: "BTW/TVA" },
    PL: { name: "Poland", standard: 23, reduced: 8, superReduced: 5, label: "VAT" },
    CZ: { name: "Czechia", standard: 21, reduced: 12, label: "DPH" },
    SK: { name: "Slovakia", standard: 20, reduced: 10, label: "DPH" },
    HU: { name: "Hungary", standard: 27, reduced: 5, label: "ÁFA" },
    RO: { name: "Romania", standard: 19, reduced: 5, label: "TVA" },
    BG: { name: "Bulgaria", standard: 20, reduced: 9, label: "ДДС" },
    HR: { name: "Croatia", standard: 25, reduced: 5, label: "PDV" },
    SI: { name: "Slovenia", standard: 22, reduced: 5, label: "DDV" },
    GR: { name: "Greece", standard: 24, reduced: 6, label: "ΦΠΑ" },
    PT: { name: "Portugal", standard: 23, reduced: 6, label: "IVA" },
    IE: { name: "Ireland", standard: 23, reduced: 9, label: "VAT" },
    DK: { name: "Denmark", standard: 25, label: "moms" },
    SE: { name: "Sweden", standard: 25, reduced: 6, label: "moms" },
    FI: { name: "Finland", standard: 25.5, reduced: 10, label: "ALV" },
    NO: { name: "Norway", standard: 25, reduced: 15, label: "MVA" },
    LT: { name: "Lithuania", standard: 21, reduced: 9, label: "PVM" },
    LV: { name: "Latvia", standard: 21, reduced: 12, label: "PVN" },
    EE: { name: "Estonia", standard: 22, reduced: 9, label: "km" },
    LU: { name: "Luxembourg", standard: 17, reduced: 8, label: "TVA" },
    CY: { name: "Cyprus", standard: 19, reduced: 5, label: "VAT" },
    MT: { name: "Malta", standard: 18, reduced: 5, label: "VAT" },
    UA: { name: "Ukraine", standard: 20, reduced: 7, label: "ПДВ" },
    GB: { name: "United Kingdom", standard: 20, reduced: 5, label: "VAT" },
    US: { name: "United States", standard: 0, label: "Sales tax" }, // варьируется по штату — считаем вручную
    CA: { name: "Canada", standard: 5, label: "GST" }, // + провинциальный налог отдельно
    AE: { name: "United Arab Emirates", standard: 5, label: "VAT" },
    TR: { name: "Turkey", standard: 20, reduced: 10, label: "KDV" },
};

export const COUNTRY_CODES = Object.keys(COUNTRY_TAX);

// Ставка НДС/налога по умолчанию для страны фирмы; неизвестная страна или «маленькая фирма» (§19 UStG и аналоги) — 0%
export function defaultTaxRate(country: string, smallBusiness: boolean): number {
    if (smallBusiness) return 0;
    return COUNTRY_TAX[country]?.standard ?? 0;
}

export const taxLabel = (country: string) => COUNTRY_TAX[country]?.label ?? "Tax";
