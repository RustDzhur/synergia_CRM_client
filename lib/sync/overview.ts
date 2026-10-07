import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/finance/totals";

// Сводка по клиенту (контакт или фирма) или сделке: всё, что с ними связано, одним запросом — документы, оплаты,
// остаток к оплате, расходы, задачи, сделки. Карточки показывают сводку, а не собирают её из шести запросов,
// и цифры в них совпадают с цифрами финансов: считает одна и та же функция по тем же записям.

export type OverviewScope = { contact: string } | { company: string } | { deal: string };

export interface DocRow { kind: string; id: string; number: string; status: string; total: number; currency: string; at: string }

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d ?? ""));
const round = (n: number) => Math.round(n * 100) / 100;

// Документы клиента или сделки одной лентой: предложения, счета, заказы, договоры
export async function documentsOf(org: string, scope: OverviewScope): Promise<DocRow[]> {
    const [quotes, invoices, orders, contracts] = await Promise.all([
        prisma.quote.findMany({ where: { org, ...scope }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.invoice.findMany({ where: { org, ...scope }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.order.findMany({ where: { org, ...scope }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.contract.findMany({ where: { org, ...scope }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    const gross = (items: unknown) => computeTotals((items ?? []) as never).gross;
    return [
        ...quotes.map((d) => ({ kind: "quote", id: d.id, number: d.number, status: d.status, total: gross(d.items), currency: d.currency, at: iso(d.createdAt) })),
        ...invoices.map((d) => ({ kind: d.kind === "credit_note" ? "credit_note" : "invoice", id: d.id, number: d.number, status: d.status, total: gross(d.items), currency: d.currency, at: iso(d.createdAt) })),
        ...orders.map((d) => ({ kind: "order", id: d.id, number: d.number, status: d.status, total: gross(d.items), currency: d.currency, at: iso(d.createdAt) })),
        ...contracts.map((d) => ({ kind: "contract", id: d.id, number: d.number, status: d.status, total: Number(d.value) || 0, currency: d.currency, at: iso(d.createdAt) })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function overviewOf(org: string, scope: OverviewScope) {
    const taskWhere = { owner: org, ...scope };
    const [invoices, tasks, deals, stages] = await Promise.all([
        prisma.invoice.findMany({ where: { org, ...scope, kind: "invoice", status: { notIn: ["draft", "cancelled"] } }, orderBy: { createdAt: "desc" }, take: 200 }),
        prisma.task.findMany({ where: taskWhere, orderBy: [{ completed: "asc" }, { deadline: "asc" }], take: 50 }),
        "deal" in scope
            ? Promise.resolve([])
            : prisma.deal.findMany({ where: { owner: org, ...scope }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, clientName: true, stage: true, wonAt: true, endDate: true, responsible: true } }),
        prisma.stage.findMany({ where: { owner: org }, select: { id: true, name: true } }),
    ]);
    const stageName = new Map(stages.map((s) => [s.id, s.name]));

    // расходы привязаны только к сделке: у клиента берём расходы его сделок
    const dealIds = "deal" in scope ? [scope.deal] : (await prisma.deal.findMany({ where: { owner: org, ...scope }, select: { id: true } })).map((d) => d.id);
    const [expenses, payments, documents] = await Promise.all([
        dealIds.length ? prisma.expense.findMany({ where: { org, deal: { in: dealIds } }, orderBy: { date: "desc" }, take: 50 }) : Promise.resolve([]),
        invoices.length ? prisma.paymentEvent.findMany({ where: { org, invoice: { in: invoices.map((i) => i.id) } }, orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
        documentsOf(org, scope),
    ]);
    const numberOf = new Map(invoices.map((i) => [i.id, i.number]));

    const today = new Date().toISOString().slice(0, 10);
    const invoiceRows = invoices.map((i) => {
        const total = computeTotals((i.items ?? []) as never).gross;
        const paid = Number(i.paidAmount) || 0;
        const due = i.status === "paid" ? 0 : Math.max(0, round(total - paid));
        return { id: i.id, number: i.number, status: i.status, total, paid, due, dueDate: i.dueDate, currency: i.currency, overdue: i.status === "overdue" || (i.status === "sent" && !!i.dueDate && i.dueDate < today) };
    });

    // итоги по валютам: суммы в разных валютах не складываются
    const byCurrency = new Map<string, { currency: string; invoiced: number; paid: number; outstanding: number; expenses: number }>();
    const slot = (c: string) => byCurrency.get(c) ?? (byCurrency.set(c, { currency: c, invoiced: 0, paid: 0, outstanding: 0, expenses: 0 }), byCurrency.get(c)!);
    for (const r of invoiceRows) { const s = slot(r.currency); s.invoiced += r.total; s.paid += Math.min(r.paid, r.total); s.outstanding += r.due; }
    for (const e of expenses) slot(e.currency).expenses += e.amount;
    const summary = Array.from(byCurrency.values()).map((s) => ({ ...s, invoiced: round(s.invoiced), paid: round(s.paid), outstanding: round(s.outstanding), expenses: round(s.expenses), margin: round(s.paid - s.expenses) }));

    return {
        summary,
        deals: deals.map((d) => ({ id: d.id, name: d.clientName, stage: d.stage, stageName: stageName.get(d.stage) ?? "", won: !!d.wonAt, endDate: d.endDate, responsible: d.responsible })),
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, deadline: t.deadline, completed: t.completed, responsible: t.responsible })),
        invoices: invoiceRows,
        payments: payments.map((p) => ({ id: p.id, invoice: p.invoice, number: numberOf.get(p.invoice) ?? "", amount: p.amount, currency: p.currency, source: p.source, via: p.via, at: iso(p.createdAt) })),
        expenses: expenses.map((e) => ({ id: e.id, vendor: e.vendor, amount: e.amount, currency: e.currency, date: e.date, deal: e.deal })),
        documents,
    };
}
