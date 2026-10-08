import { suggestMatches } from "./bank";
import { computeTotals } from "./totals";
import { prisma } from "@/lib/prisma";
import { categoryFor } from "@/lib/review/rules";

// Общий путь записи строк выписки в журнал движений: им пользуются и импорт CSV, и синхронизация
// с банком по API (monobank) — правила одни и те же: дубликат по внешнему идентификатору не
// создаётся, а к каждой новой строке подбирается предполагаемая пара (счёт клиенту или расход),
// причём уверенное совпадение (номер в назначении или сумма и дата рядом) ставится сразу, слабое
// (только по сумме) остаётся подсказкой человеку.

export interface ImportBankRow {
    date: string; // YYYY-MM-DD
    amount: number; // плюс — приход, минус — расход
    counterparty: string;
    reference: string;
    externalId: string;
}

export interface ImportBankResult {
    created: Array<Record<string, unknown>>;
    skipped: number; // сколько строк не взяли: дубликаты и пустые
    suggestions: number;
}

export async function importBankRows(
    org: string,
    account: { id: string; currency?: string },
    rows: ImportBankRow[],
    source: "import" | "auto"
): Promise<ImportBankResult> {
    // повторный импорт того же файла/выписки не должен задваивать движения
    const known = await prisma.bankTransaction.findMany({ where: { org, account: account.id, externalId: { not: "" } }, select: { externalId: true } });
    const seen = new Set(known.map((k) => k.externalId));
    const fresh = rows.filter((r) => !r.externalId || !seen.has(r.externalId));

    // подсказки по сверке: открытые счета клиентам и расходы за тот же период
    const dates = fresh.map((r) => r.date).sort();
    const [invoices, expenses] = dates.length
        ? await Promise.all([
            prisma.invoice.findMany({ where: { org, kind: "invoice", status: { notIn: ["draft", "cancelled", "paid"] }, issueDate: { lte: dates[dates.length - 1] } }, select: { id: true, number: true, customerName: true, items: true, currency: true, issueDate: true } }),
            prisma.expense.findMany({ where: { org, date: { gte: dates[0], lte: dates[dates.length - 1] } }, select: { id: true, vendor: true, amount: true, date: true } }),
        ])
        : [[], []];
    const candidates = [
        ...invoices.map((inv) => ({ id: inv.id, label: `${inv.number} ${inv.customerName}`, amount: computeTotals(inv.items as never).gross, date: inv.issueDate ?? "" })),
        ...expenses.map((e) => ({ id: e.id, label: `${e.vendor}`, amount: -(Number(e.amount) || 0), date: e.date })),
    ];
    const suggestions = suggestMatches(fresh.map((r, index) => ({ index, amount: r.amount, date: r.date, reference: r.reference, counterparty: r.counterparty })), candidates);
    const byIndex = new Map(suggestions.map((s) => [Number(s.transactionExternalId), s]));

    // правила сверки фирмы («контрагент содержит … → статья») размечают новые строки сразу
    const rules = await prisma.practiceRule.findMany({ where: { org }, orderBy: { createdAt: "asc" } });
    const ruleHits = new Map<string, number>();
    const created: Array<Record<string, unknown>> = [];
    for (let i = 0; i < fresh.length; i++) {
        const row = fresh[i];
        const hint = byIndex.get(i);
        const byRule = categoryFor(rules, row);
        if (byRule) ruleHits.set(byRule.rule, (ruleHits.get(byRule.rule) ?? 0) + 1);
        const isInvoice = hint && invoices.some((inv) => inv.id === hint.candidateId);
        try {
            const doc = await prisma.bankTransaction.create({
                data: {
                    org, account: account.id, date: row.date, amount: row.amount, currency: account.currency,
                    counterparty: row.counterparty, reference: row.reference, externalId: row.externalId, source, category: byRule?.category ?? "",
                    // привязку ставим только при уверенном совпадении: по номеру документа или по сумме и дате.
                    // Слабая догадка (только по сумме) остаётся подсказкой, а не фактом.
                    matchType: hint && hint.score >= 2 ? (isInvoice ? "invoice" : "expense") : "",
                    matchId: hint && hint.score >= 2 ? hint.candidateId : undefined,
                },
            });
            created.push(doc as never);
        } catch { /* дубликат внешнего идентификатора — пропускаем */ }
    }
    for (const [id, c] of Array.from(ruleHits)) await prisma.practiceRule.update({ where: { id }, data: { hits: { increment: c } } }).catch(() => undefined);
    return { created, skipped: rows.length - fresh.length, suggestions: suggestions.length };
}
