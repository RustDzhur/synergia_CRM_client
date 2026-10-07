import { emit } from "@/lib/automation/emit";
import { notify } from "@/lib/notify";
import { logDocEvent } from "@/lib/sync/documents";
import { recordSyncError } from "@/lib/sync/errors";
import { prisma } from "@/lib/prisma";

// Просроченные счета: "sent", срок оплаты в прошлом — переводит в "overdue", сообщает автоматизации, пишет в ленту клиента и
// уведомляет фирму (по одному разу на счёт, дальше статус уже не "sent" и повторно не попадёт в выборку).
// Вызывается из дневного крона (см. app/api/cron/automation).
export async function sweepOverdueInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    const due = await prisma.invoice.findMany({ where: { status: "sent", dueDate: { not: "", lt: today } }, select: { id: true, org: true, number: true, customerName: true, deal: true, contact: true, company: true } });
    for (const inv of due) {
        // updateMany с условием статуса: параллельный обход не обработает счёт дважды
        const moved = await prisma.invoice.updateMany({ where: { id: inv.id, status: "sent" }, data: { status: "overdue" } });
        if (!moved.count) continue;
        const org = String(inv.org);
        await emit(org, { type: "invoice_overdue", data: { id: inv.id, number: inv.number, customerName: inv.customerName, dealId: inv.deal ?? "" } });
        try {
            await logDocEvent(org, inv, "invoice", `Счёт ${inv.number} просрочен`, "overdue");
            await notify(org, { type: "message", params: { name: inv.customerName || inv.number, channel: "invoice", text: `Счёт ${inv.number} просрочен` }, link: "/crm/finance?tab=invoices", key: `overdue:${inv.id}` });
        } catch (e) {
            await recordSyncError(org, "overdue.notify", e, { id: inv.id });
        }
    }
    return due.length;
}
