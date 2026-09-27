// Амортизация основных средств (AfA) — прямолинейный способ.
// Считается от стоимости за вычетом ликвидационной, по месяцам: в Германии принято списывать
// начиная с месяца приобретения (§7 EStG), поэтому месяц покупки уже входит в амортизацию.

export interface DepreciableAsset {
    name: string;
    acquiredDate: string;   // "YYYY-MM-DD"
    cost: number;
    usefulLifeYears: number;
    residualValue?: number;
    disposalDate?: string;  // пусто — средство ещё используется
}

export interface DepreciationRow {
    period: string;   // "YYYY-MM"
    amount: number;   // амортизация за месяц
    bookValue: number; // остаточная стоимость на конец месяца
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const monthIndex = (date?: string) => {
    const [y, m] = (date || "").split("-").map(Number);
    return Number.isFinite(y) && Number.isFinite(m) ? y * 12 + (m - 1) : NaN;
};
const periodOf = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

// Сколько всего можно списать: стоимость минус ликвидационная
export const depreciableBase = (a: DepreciableAsset) => Math.max(0, (Number(a.cost) || 0) - (Number(a.residualValue) || 0));

// Помесячная амортизация. Срок в годах переводим в месяцы; последний месяц получает остаток,
// чтобы сумма списаний точно совпала с базой (иначе копейки «зависают» навсегда).
export function depreciationSchedule(a: DepreciableAsset): DepreciationRow[] {
    const months = Math.round((Number(a.usefulLifeYears) || 0) * 12);
    const base = depreciableBase(a);
    const start = monthIndex(a.acquiredDate);
    if (!months || !base || !Number.isFinite(start)) return [];

    const end = Number.isFinite(monthIndex(a.disposalDate)) ? monthIndex(a.disposalDate) : start + months - 1;
    const monthly = round2(base / months);
    const rows: DepreciationRow[] = [];
    let written = 0;

    for (let i = 0; i < months; i++) {
        const index = start + i;
        if (index > end) break; // выбытие прекращает амортизацию
        // последний месяц списывает остаток базы — так сумма строк всегда равна базе
        const amount = i === months - 1 ? round2(base - written) : monthly;
        written = round2(written + amount);
        rows.push({ period: periodOf(index), amount, bookValue: round2(base - written + (Number(a.residualValue) || 0)) });
    }
    return rows;
}

// Амортизация за отрезок [from, to] (обе даты "YYYY-MM-DD"): то, что относится к периоду,
// независимо от того, когда средство купили и сколько ему ещё списываться.
export function depreciationInRange(a: DepreciableAsset, from: string, to: string): number {
    const f = monthIndex(from);
    const t = monthIndex(to);
    if (!Number.isFinite(f) || !Number.isFinite(t)) return 0;
    return round2(depreciationSchedule(a).filter((r) => {
        const i = monthIndex(`${r.period}-01`);
        return i >= f && i <= t;
    }).reduce((s, r) => s + r.amount, 0));
}

// Остаточная стоимость на дату — то, что ещё числится за средством
export function bookValueAt(a: DepreciableAsset, date: string): number {
    const base = depreciableBase(a) + (Number(a.residualValue) || 0);
    const d = monthIndex(date);
    if (!Number.isFinite(d)) return round2(base);
    const written = depreciationSchedule(a)
        .filter((r) => monthIndex(`${r.period}-01`) <= d)
        .reduce((s, r) => s + r.amount, 0);
    return round2(base - written);
}

// Сводка по всем средствам за период — попадает в EÜR и BWA отдельной строкой и в отчёт по активам
export interface AssetsSummary {
    totalCost: number;
    depreciation: number;   // за период
    depreciationToDate: number; // накопленная за всё время
    bookValue: number;      // остаточная на конец периода
    rows: Array<{ name: string; category: string; acquiredDate: string; cost: number; periodAmount: number; bookValue: number; usefulLifeYears: number }>;
}

export function assetsSummary(assets: Array<DepreciableAsset & { category?: string }>, from: string, to: string): AssetsSummary {
    const rows = assets.map((a) => ({
        name: a.name,
        category: a.category ?? "",
        acquiredDate: a.acquiredDate,
        cost: round2(Number(a.cost) || 0),
        usefulLifeYears: a.usefulLifeYears,
        periodAmount: depreciationInRange(a, from, to),
        bookValue: bookValueAt(a, to),
    }));
    return {
        totalCost: round2(rows.reduce((s, r) => s + r.cost, 0)),
        depreciation: round2(rows.reduce((s, r) => s + r.periodAmount, 0)),
        depreciationToDate: round2(assets.reduce((s, a) => s + (depreciableBase(a) - (bookValueAt(a, to) - (Number(a.residualValue) || 0))), 0)),
        bookValue: round2(rows.reduce((s, r) => s + r.bookValue, 0)),
        rows,
    };
}
