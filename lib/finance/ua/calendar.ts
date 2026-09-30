import type { UaTaxProfile } from "../ua";

// Календарь платежей украинской фирмы (ТЗ §9): когда и сколько платить — единый налог, военный сбор,
// ЄСВ и ПДВ, плюс сроки деклараций. Это справочный план, а не налоговая консультация: суммы берутся
// из книги доходов и настроек фирмы, а сами сроки помечены [проверить] — их подтверждает бухгалтер.
//
// Даты считаются по общим правилам ПКУ (20-е число для месячных платежей, 40 дней после квартала —
// предельный срок квартальной декларации єдиного налога); для 1–2 групп ЄП платится авансом.

export interface PaymentEntry {
    date: string; // YYYY-MM-DD
    title: string; // человеческая подпись («ЄСВ за січень»)
    amount: number; // ₴, справочно
    kind: "esv" | "single" | "military" | "vat";
    note: string; // пояснение: откуда сумма и что проверить
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Календарь платежей на год: суммы — из книги доходов по кварталам (по оплате). */
export function paymentCalendar(year: number, profile: UaTaxProfile, quarters: Array<{ quarter: number; income: number; singleTax: number; military: number; esv: number }>): PaymentEntry[] {
    const out: PaymentEntry[] = [];
    const check = "строк [проверить] у бухгалтера";

    // ЄСВ — каждый месяц, до 20-го числа следующего месяца (за себя; у ФОП на общей системе так же)
    for (let m = 1; m <= 12; m++) {
        const due = m === 12 ? iso(year + 1, 1, 20) : iso(year, m + 1, 20);
        out.push({
            date: due,
            title: `ЄСВ за ${monthName(m)}`,
            amount: profile.esvMonthly,
            kind: "esv",
            note: `Мінімальний внесок за себе; ${check}`,
        });
    }

    // Єдиний податок и военный сбор — по кварталам. ПКУ 296.3: декларация — 40 дней после квартала,
    // а уплата — 10 дней после граничного срока подачи, то есть 50-й день. Раньше здесь стоял 40-й
    // день (срок декларации) — для календаря платежей это на 10 дней раньше действительного.
    if (profile.group >= 1 && profile.group <= 3) {
        for (const q of quarters) {
            const endMonth = q.quarter * 3;
            const dueDate = new Date(Date.UTC(year, endMonth, 0)); // последний день квартала
            dueDate.setUTCDate(dueDate.getUTCDate() + 50); // + 50 дней: 40 на декларацию и 10 на уплату [проверить]
            const date = dueDate.toISOString().slice(0, 10);
            out.push({
                date,
                title: `Єдиний податок за ${q.quarter}-й квартал`,
                amount: q.singleTax,
                kind: "single",
                note: `Ставка ${profile.singleRate} % від доходу кварталу (${q.income.toFixed(2)} ₴); ${check} · декларація — 40 днів після кварталу, сплата — ще 10 днів`,
            });
            if (q.military > 0) {
                out.push({
                    date,
                    title: `Військовий збір за ${q.quarter}-й квартал`,
                    amount: q.military,
                    kind: "military",
                    note: profile.group === 3 ? `${profile.militaryRate} % від доходу; ${check}` : `Фіксована сума за місяці кварталу; ${check}`,
                });
            }
        }
    }

    // ПДВ: декларация — до 20-го числа следующего месяца (или 40 дней после квартала), уплата — ещё
    // 10 дней после граничного срока подачи. Поэтому платёж стоит на 30-е число (месячный период)
    // или на 50-й день после квартала — это и есть «когда платить» [проверить]
    if (profile.vatPayer) {
        if (profile.vatPeriod === "month") {
            for (let m = 1; m <= 12; m++) {
                const next = m === 12 ? { y: year + 1, m: 1 } : { y: year, m: m + 1 };
                const lastDay = new Date(Date.UTC(next.y, next.m, 0)).getUTCDate(); // 30-й день, а в феврале — 28/29
                const due = iso(next.y, next.m, Math.min(30, lastDay));
                out.push({ date: due, title: `ПДВ за ${monthName(m)}`, amount: 0, kind: "vat", note: `Сума — з реєстру ПН за місяць; декларація до 20-го, сплата ще 10 днів; ${check}` });
            }
        } else {
            for (let q = 1; q <= 4; q++) {
                const dueDate = new Date(Date.UTC(year, q * 3, 0)); // последний день квартала
                dueDate.setUTCDate(dueDate.getUTCDate() + 50);
                out.push({ date: dueDate.toISOString().slice(0, 10), title: `ПДВ за ${q}-й квартал`, amount: 0, kind: "vat", note: `Сума — з реєстру ПН за квартал; ${check}` });
            }
        }
    }

    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

const MONTHS = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
export const monthName = (m: number) => MONTHS[m - 1] ?? String(m);

/** Сводка календаря: сколько всего по плану и какой платёж следующий. */
export function calendarSummary(entries: PaymentEntry[]): { total: number; next: PaymentEntry | null; notice: string } {
    const today = new Date().toISOString().slice(0, 10);
    const total = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
        total,
        next: entries.find((e) => e.date >= today) ?? null,
        notice: "Це довідковий план: суми рахуються з ваших даних, строки — за загальними правилами; перед сплатою звіртеся з бухгалтером.",
    };
}
