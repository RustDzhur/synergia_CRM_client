import { prisma } from "@/lib/prisma";
import { cleanItems, computeTotals } from "@/lib/finance/totals";

// Тестовые («демо») данные бухгалтерии: оплаченные счета и расходы за месяцы текущего года, чтобы владелец мог посмотреть, как графики,
// отчёты и дашборд отображают движение денег. Такие записи НАСТОЯЩИЕ в базе фирмы, поэтому они помечены: у счетов номер DEMO-ГГГГ-NNNN
// (отдельная нумерация — боевые номера счетов не расходуются и в них нет «дыр»), у клиентов и поставщиков в названии стоит [ДЕМО].
// Удаляются одной командой (deleteDemo). До настоящей подачи отчётов в налоговую их нужно убрать — Айрис напоминает об этом одной фразой.
export const DEMO_PREFIX = "DEMO-";
export const DEMO_TAG = "[ДЕМО]";

const CUSTOMERS = ["Muster GmbH", "Nordwind AG", "Kovalenko & Co", "Bauer Technik", "Lviv Trade", "Schmidt Logistik", "Dnipro Soft", "Klein Handel"];
const VENDORS = ["Büro Express", "Telekom", "Amazon Business", "Miete Büro", "Google Workspace", "Werbung Meta", "Nova Poshta", "Steuerberater"];
const CATEGORIES = ["office", "software", "marketing", "rent", "travel", "services"];
const SERVICES = ["Beratung", "Entwicklung", "Wartung", "Lieferung", "Schulung", "Abonnement"];

const pick = <T,>(list: T[], i: number) => list[i % list.length];
const rnd = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const pad = (n: number) => String(n).padStart(2, "0");

export interface DemoOpts { fromMonth?: number; perMonth?: number; expensesPerMonth?: number }

/** Создаёт демо-счета (оплаченные) и расходы с fromMonth (по умолчанию январь) по текущий месяц года `today`. */
export async function seedDemo(c: { org: string; userId: string; today: string }, currency: string, authorName: string, opts: DemoOpts = {}) {
    const year = Number(c.today.slice(0, 4));
    const nowMonth = Number(c.today.slice(5, 7));
    const from = Math.min(Math.max(Math.round(Number(opts.fromMonth) || 1), 1), nowMonth);
    const perMonth = Math.min(Math.max(Math.round(Number(opts.perMonth) || 4), 1), 10);
    const expPerMonth = Math.min(Math.max(Math.round(opts.expensesPerMonth === undefined ? 3 : Number(opts.expensesPerMonth) || 0), 0), 10);

    let seq = await prisma.invoice.count({ where: { org: c.org, number: { startsWith: `${DEMO_PREFIX}${year}-` } } });
    let invoices = 0, expenses = 0, revenue = 0, costs = 0;
    for (let month = from; month <= nowMonth; month++) {
        const lastDay = month === nowMonth ? Number(c.today.slice(8, 10)) : new Date(year, month, 0).getDate();
        for (let i = 0; i < perMonth; i++) {
            const day = Math.max(1, Math.min(lastDay, rnd(1, lastDay)));
            const issue = `${year}-${pad(month)}-${pad(day)}`;
            const due = new Date(Date.UTC(year, month - 1, day + 14)).toISOString().slice(0, 10);
            const price = rnd(300, 4000);
            const items = cleanItems([{ description: pick(SERVICES, i + month), qty: 1, unitPrice: price, taxRate: 0 }] as never);
            const gross = computeTotals(items as never).gross;
            const at = new Date(Date.UTC(year, month - 1, Math.min(lastDay, day + 3), 10, 0, 0));
            await prisma.invoice.create({
                data: {
                    org: c.org, number: `${DEMO_PREFIX}${year}-${String(++seq).padStart(4, "0")}`, kind: "invoice", customerName: `${DEMO_TAG} ${pick(CUSTOMERS, i + month)}`,
                    items: items as never, currency, issueDate: issue, dueDate: due, supplyDate: issue, status: "paid", sentAt: at, paidAt: at, paidAmount: gross,
                    notes: "Тестовые данные. Удаляются командой «удали демо-данные».", createdByName: authorName,
                },
            });
            invoices++; revenue += gross;
        }
        for (let i = 0; i < expPerMonth; i++) {
            const day = Math.max(1, Math.min(lastDay, rnd(1, lastDay)));
            const amount = rnd(40, 1500);
            await prisma.expense.create({
                data: { org: c.org, vendor: `${DEMO_TAG} ${pick(VENDORS, i + month)}`, category: pick(CATEGORIES, i + month), amount, currency, date: `${year}-${pad(month)}-${pad(day)}`, notes: "Тестовые данные", createdByName: authorName },
            });
            expenses++; costs += amount;
        }
    }
    return { invoices, expenses, from, to: nowMonth, revenue: Math.round(revenue), costs: Math.round(costs) };
}

/** Удаляет все демо-записи фирмы (счета DEMO-… и расходы с меткой [ДЕМО]). */
export async function deleteDemo(org: string) {
    const inv = await prisma.invoice.deleteMany({ where: { org, number: { startsWith: DEMO_PREFIX } } });
    const exp = await prisma.expense.deleteMany({ where: { org, vendor: { startsWith: DEMO_TAG } } });
    return { invoices: inv.count, expenses: exp.count };
}
