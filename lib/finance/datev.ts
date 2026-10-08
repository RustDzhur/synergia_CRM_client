import { prisma } from "@/lib/prisma";

// DATEV-Buchungsstapel (EXTF 700, Format 21): 14 обязательных колонок + строка заголовка.
// Формат помечен [проверить]: перед загрузкой в DATEV его подтверждает бухгалтер — особенно
// счета SKR03/04, которые по умолчанию 8400 (выручка 19 %) и 1200 (банк).
export async function datevCsv(org: string, o: { year: string; revenueAccount: string; bankAccount: string }): Promise<string> {
    const { year, revenueAccount, bankAccount } = o;
    const invoices = await prisma.invoice.findMany({
        where: { org, kind: "invoice", status: "paid", paidAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) } },
        orderBy: { paidAt: "asc" },
        select: { number: true, customerName: true, paidAt: true, paidAmount: true, currency: true, items: true },
    });
    const header = [
        "EXTF", "700", "21", "Buchungsstapel", "13",
        new Date().toISOString().slice(0, 19).replace(/[-:T]/g, ""),
        "", "", "", "", "", "", "", "", "1", // Herkunft/Exportiert von… (Vorgaben)
        "FIRMSPACE", "1", "20260101", `${year}1231`, "", "", "", "", "", "", "", "0",
    ];
    const columns = ["Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext"];
    const rows: Array<Array<string | number>> = [];
    for (const inv of invoices) {
        const items = (inv.items ?? []) as Array<{ qty?: number; unitPrice?: number; taxRate?: number }>;
        const gross = items.reduce((sum, it) => {
            const net = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
            return sum + net * (1 + (Number(it.taxRate) || 0) / 100);
        }, 0);
        const amount = Math.round((Number(inv.paidAmount) || gross) * 100) / 100;
        const paid = inv.paidAt ? new Date(inv.paidAt) : new Date();
        const ddmm = `${String(paid.getDate()).padStart(2, "0")}${String(paid.getMonth() + 1).padStart(2, "0")}`;
        // Банк — дебет (S), выручка — кредит (H): кассовый метод, как в книге доходов
        rows.push([amount, "S", inv.currency ?? "", "", "", "", bankAccount, revenueAccount, "", ddmm, String(inv.number ?? "").slice(0, 12), "", "", `${inv.number} ${inv.customerName}`.slice(0, 60)]);
    }
    // Самая частая ставка — 19 % даёт BU-ключ 3; в упрощённой выгрузке оставляем его пустым
    const csv = [header.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(";"), columns.map((c) => `"${c}"`).join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\r\n") + "\r\n";
    return csv;
}
