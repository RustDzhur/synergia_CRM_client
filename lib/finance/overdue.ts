import { emit } from "@/lib/automation/emit";
import { prisma } from "@/lib/prisma";

// Просроченные счета: "sent", срок оплаты в прошлом — переводит в "overdue" и сообщает автоматизации (по одному разу на счёт,
// дальше статус уже не "sent" и повторно не попадёт в выборку). Вызывается из дневного крона (см. app/api/cron/automation).
export async function sweepOverdueInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    const due = await prisma.invoice.findMany({ where: { status: "sent", dueDate: { not: "", lt: today } }, select: { id: true, org: true, number: true, customerName: true, deal: true } });
    for (const inv of due) {
        await prisma.invoice.update({ where: { id: inv.id }, data: { status: "overdue" } });
        await emit(String(inv.org), { type: "invoice_overdue", data: { id: inv.id, number: inv.number, customerName: inv.customerName, dealId: inv.deal ?? "" } });
    }
    return due.length;
}
