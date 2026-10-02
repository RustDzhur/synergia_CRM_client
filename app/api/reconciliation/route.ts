import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, contentDisposition } from "@/lib/api";
import { reconciliation, creditRoom } from "@/lib/finance/pricing";
import { toCsv } from "@/lib/import/csv";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/reconciliation?company=&from=&to=[&format=csv] — акт сверки с клиентом (ТЗ §12, «Опт»).
// Показывает начисления и оплаты периода и сальдо на конец; вместе с кредитным лимитом клиента это
// ответ на вопрос «можно ли отгружать в долг».
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company") ?? "";
    if (!companyId) return badRequest("company is required");
    const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
    const from = url.searchParams.get("from") ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const company = await prisma.company.findFirst({ where: { id: companyId, owner: user.id } });
    if (!company) return badRequest("company not found");

    const invoices = await prisma.invoice.findMany({ where: { org: user.id, company: company.id, kind: "invoice", status: { not: "cancelled" } }, select: { number: true, issueDate: true, items: true, paidAmount: true, smallBusinessNote: true, currency: true } });
    const rowsInput = invoices.map((inv) => {
        const items = (inv.items ?? []) as Array<{ qty?: number; unitPrice?: number; taxRate?: number }>;
        const gross = items.reduce((sum, it) => {
            const net = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
            return sum + net * (1 + (Number(it.taxRate) || 0) / 100);
        }, 0);
        return { number: inv.number, date: String(inv.issueDate ?? ""), amount: Math.round((inv.smallBusinessNote ? items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0) : gross) * 100) / 100, paid: Number(inv.paidAmount) || 0 };
    });

    const result = reconciliation({ invoices: rowsInput, from, to });
    const open = rowsInput.filter((r) => r.date <= to && r.amount - r.paid > 0);
    const used = Math.round(open.reduce((s, r) => s + (r.amount - r.paid), 0) * 100) / 100;
    const room = creditRoom({ used, limit: Number(company.creditLimit) || 0, overdue: 0 }, 0);
    const payload = {
        company: company.name,
        from,
        to,
        ...result,
        credit: { used, limit: Number(company.creditLimit) || 0, room: room ? room.leftAfter : null, priceType: company.priceType ?? "", paymentDays: company.paymentDays ?? 0 },
    };

    if (url.searchParams.get("format") === "csv") {
        const csv = toCsv(
            ["Дата", "Документ", "Нараховано", "Оплачено", "Сальдо"],
            [["", "Сальдо на початок", "", "", result.opening], ...result.rows.map((r) => [r.date, r.number, r.charged, r.paid, r.balance]), ["", "Сальдо на кінець", "", "", result.closing]]
        );
        return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": contentDisposition(`reconciliation-${company.name}.csv`, "attachment"), "Cache-Control": "no-store" } });
    }
    return NextResponse.json(payload);
}
