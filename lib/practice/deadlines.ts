// Ближайшие сроки отчётности по рынку — данные, а не код: источник у каждого срока, непроверенные помечены.
// Срок — день месяца, следующего за отчётным месяцем. Праздничные переносы не учитываются (подсказка, не юридическая консультация).

export interface DeadlineRule { code: string; day: number; source: string; verified: boolean }

export const DEADLINE_RULES: Record<string, DeadlineRule[]> = {
    DE: [{ code: "vat_return", day: 10, source: "§ 18 Abs. 1 UStG (Umsatzsteuer-Voranmeldung; Dauerfristverlängerung не учтена)", verified: true }],
    UA: [{ code: "vat_return", day: 20, source: "ПКУ ст. 203.1 (декларація з ПДВ — протягом 20 календарних днів після звітного місяця)", verified: true }],
    UZ: [{ code: "vat_return", day: 20, source: "Налоговый кодекс РУз — срок QQS-декларации требует проверки специалистом по tax.uz", verified: false }],
};

export interface UpcomingDeadline { code: string; date: string; daysLeft: number; source: string; verified: boolean }

export function upcomingDeadlines(market: string | null, today = new Date()): UpcomingDeadline[] {
    const rules = (market && DEADLINE_RULES[market]) || [];
    const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return rules.map((r) => {
        // срок в этом месяце (за прошлый месяц), если ещё не прошёл, иначе — в следующем
        let d = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), r.day);
        if (d < t0) d = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, r.day);
        return { code: r.code, date: new Date(d).toISOString().slice(0, 10), daysLeft: Math.round((d - t0) / 86_400_000), source: r.source, verified: r.verified };
    });
}
