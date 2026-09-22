import { emit } from "@/lib/automation/emit";
import Invoice from "@/models/Invoice";

// Просроченные счета: "sent", срок оплаты в прошлом — переводит в "overdue" и сообщает автоматизации (по одному разу на счёт,
// дальше статус уже не "sent" и повторно не попадёт в выборку). Вызывается из дневного крона (см. app/api/cron/automation).
export async function sweepOverdueInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    const due = await Invoice.find({ status: "sent", dueDate: { $ne: "", $lt: today } }).select("org number customerName deal");
    for (const inv of due) {
        await Invoice.updateOne({ _id: inv._id }, { $set: { status: "overdue" } });
        await emit(String(inv.org), { type: "invoice_overdue", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName, dealId: inv.deal ? String(inv.deal) : "" } });
    }
    return due.length;
}
