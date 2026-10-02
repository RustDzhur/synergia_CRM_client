// Готовые ответы на самые частые голосовые вопросы — без второго круга модели.
//
// После «открой бухгалтерию и покажи неоплаченные счета» модель уже вызвала инструменты; чтобы произнести итог,
// раньше требовался ещё один её круг (3–5 секунд ожидания). Для списков счетов, обзора бухгалтерии и остатков склада
// итог — это несколько чисел, и сервер сам проговаривает их на языке просьбы. Остальное по-прежнему отвечает модель.
export type Lang = "ru" | "uk" | "de" | "en";
export interface ToolOut { name: string; out: Record<string, any> }

export const FAST_TOOLS = new Set(["navigate", "list_invoices", "finance_summary", "list_products"]);

/** Язык просьбы по алфавиту: ы/э/ъ — русский, і/ї/є — украинский, другая кириллица — русский, ä/ö/ü или немецкие слова — немецкий. */
export function langOf(text: string): Lang {
    if (/[іїєґ]/i.test(text) && !/[ыэъ]/i.test(text)) return "uk";
    if (/[Ѐ-ӿ]/.test(text)) return "ru";
    if (/[äöüß]|\b(öffne|zeig|zeige|gehe|bitte|mir|die|das|und|Rechnungen|Lager)\b/i.test(text)) return "de";
    return "en";
}

const T: Record<Lang, Record<string, string>> = {
    ru: { open: "Открываю: {label}.", unpaid: "Неоплаченных счетов", overdue: "Просроченных счетов", draft: "Черновиков счетов", sent: "Отправленных счетов", paid: "Оплаченных счетов", all: "Счетов", none: "{what}: нет.", count: "{what}: {n}{sum}.", sum: " на сумму {sums}", oldest: " Самый старый — {number}, {customer}, просрочен на {d} {days}.", sumTotal: "Не оплачено счетов: {n}{sum}, из них просрочено {o}.", month: " За месяц получено {inc}, расходов {exp}.", stock: "Нет в наличии: {out}, заканчивается: {low}.", first: " В первую очередь: {names}.", stockOk: "Всё в наличии, ничего не заканчивается.", and: " и " },
    uk: { open: "Відкриваю: {label}.", unpaid: "Неоплачених рахунків", overdue: "Прострочених рахунків", draft: "Чернеток рахунків", sent: "Надісланих рахунків", paid: "Оплачених рахунків", all: "Рахунків", none: "{what}: немає.", count: "{what}: {n}{sum}.", sum: " на суму {sums}", oldest: " Найстаріший — {number}, {customer}, прострочений на {d} {days}.", sumTotal: "Неоплачено рахунків: {n}{sum}, з них прострочено {o}.", month: " За місяць отримано {inc}, витрат {exp}.", stock: "Немає в наявності: {out}, закінчується: {low}.", first: " Насамперед: {names}.", stockOk: "Усе є в наявності, нічого не закінчується.", and: " і " },
    de: { open: "Ich öffne: {label}.", unpaid: "Unbezahlte Rechnungen", overdue: "Überfällige Rechnungen", draft: "Rechnungsentwürfe", sent: "Versendete Rechnungen", paid: "Bezahlte Rechnungen", all: "Rechnungen", none: "{what}: keine.", count: "{what}: {n}{sum}.", sum: " über {sums}", oldest: " Die älteste ist {number}, {customer}, {d} {days} überfällig.", sumTotal: "Unbezahlte Rechnungen: {n}{sum}, davon überfällig: {o}.", month: " Diesen Monat eingegangen: {inc}, Ausgaben: {exp}.", stock: "Nicht auf Lager: {out}, wird knapp: {low}.", first: " Zuerst: {names}.", stockOk: "Alles vorrätig, nichts wird knapp.", and: " und " },
    en: { open: "Opening: {label}.", unpaid: "Unpaid invoices", overdue: "Overdue invoices", draft: "Draft invoices", sent: "Sent invoices", paid: "Paid invoices", all: "Invoices", none: "{what}: none.", count: "{what}: {n}{sum}.", sum: " totalling {sums}", oldest: " The oldest is {number}, {customer}, {d} {days} overdue.", sumTotal: "Unpaid invoices: {n}{sum}, of which overdue: {o}.", month: " This month received {inc}, expenses {exp}.", stock: "Out of stock: {out}, running low: {low}.", first: " First: {names}.", stockOk: "Everything is in stock, nothing is running low.", and: " and " },
};

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const money = (m: Record<string, number> | undefined, and: string) => Object.entries(m ?? {}).filter(([, v]) => v).map(([c, v]) => `${Math.round(v * 100) / 100} ${c}`).join(and);
// «день / дня / дней» (ru), «день / дні / днів» (uk)
const days = (n: number, lang: Lang) => {
    if (lang === "de") return n === 1 ? "Tag" : "Tage";
    if (lang === "en") return n === 1 ? "day" : "days";
    const m10 = n % 10, m100 = n % 100;
    const one = m10 === 1 && m100 !== 11, few = m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14);
    return lang === "ru" ? (one ? "день" : few ? "дня" : "дней") : one ? "день" : few ? "дні" : "днів";
};

/** Ответ вслух по результатам инструментов этого шага; null — случай нестандартный, пусть отвечает модель. */
export function fastReply(outs: ToolOut[], userText: string): string | null {
    if (!outs.length || !outs.every((o) => FAST_TOOLS.has(o.name))) return null;
    const lang = langOf(userText);
    const t = T[lang];
    const parts: string[] = [];
    for (const { name, out } of outs) {
        if (name === "navigate") parts.push(fill(t.open, { label: out.opened ?? "" }));
        else if (name === "list_invoices") {
            const what = t[out.filter as string] ?? t.all;
            const n = Number(out.count) || 0;
            if (!n) { parts.push(fill(t.none, { what })); continue; }
            const sums = money(out.openAmountByCurrency, t.and);
            let s = fill(t.count, { what, n, sum: sums ? fill(t.sum, { sums }) : "" });
            const oldest = (out.invoices as any[] | undefined)?.find((i) => i.daysOverdue > 0);
            if (oldest) s += fill(t.oldest, { number: oldest.number, customer: oldest.customer, d: oldest.daysOverdue, days: days(oldest.daysOverdue, lang) });
            parts.push(s);
        } else if (name === "finance_summary") {
            const sums = money(out.unpaidByCurrency, t.and);
            let s = fill(t.sumTotal, { n: out.unpaidCount ?? 0, sum: sums ? fill(t.sum, { sums }) : "", o: out.overdueCount ?? 0 });
            const inc = money(out.receivedThisMonth, t.and), exp = money(out.expensesThisMonth, t.and);
            if (inc || exp) s += fill(t.month, { inc: inc || "0", exp: exp || "0" });
            parts.push(s);
        } else if (name === "list_products") {
            const out0 = Number(out.outOfStock) || 0, low = Number(out.lowStock) || 0;
            if (!out0 && !low) { parts.push(t.stockOk); continue; }
            let s = fill(t.stock, { out: out0, low });
            const names = ((out.products as any[] | undefined) ?? []).slice(0, 3).map((p) => p.name).join(", ");
            if (names) s += fill(t.first, { names });
            parts.push(s);
        }
    }
    return parts.join(" ");
}

/** «Готово.» на языке просьбы — когда изменение выполнено сразу (режим без подтверждения), пересказывать нечего. */
export const doneReply = (userText: string) => ({ ru: "Готово.", uk: "Готово.", de: "Erledigt.", en: "Done." })[langOf(userText)];
