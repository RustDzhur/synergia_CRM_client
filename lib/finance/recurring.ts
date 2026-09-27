import { nextNumber } from "./numbering";
import { financeSettings } from "./settings";
import { applyTaxPolicy } from "./tax";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import RecurringInvoice from "@/models/RecurringInvoice";
import Invoice from "@/models/Invoice";

// Следующая дата запуска: тот же день месяца в следующем периоде (monthly/yearly), обрезанный до последнего дня
// месяца, если dayOfMonth в нём не существует (dayOfMonth и так ограничен 1..28, так что это на будущее — если
// поле когда-нибудь расширят до 31, короткие месяцы всё равно не сломаются).
function advance(dateStr: string, interval: "monthly" | "yearly", dayOfMonth: number): string {
    const d = new Date(dateStr + "T00:00:00.000Z");
    if (interval === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dayOfMonth, lastDay));
    return d.toISOString().slice(0, 10);
}

// Крон (app/api/cron/automation): находит шаблоны с nextRunDate <= сегодня и создаёт из каждого новый Invoice —
// черновик на проверку или сразу отправленный счёт (autoSend), в зависимости от настройки шаблона. Дальше сдвигает
// nextRunDate на следующий период, чтобы шаблон не сработал повторно за тот же цикл.
export async function runRecurringInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    const due = await RecurringInvoice.find({ active: true, nextRunDate: { $lte: today } });
    let created = 0;
    for (const r of due) {
        const org = String(r.org);
        const settings = await financeSettings(org);
        const number = await nextNumber(org, settings.invoicePrefix || "RE");
        const dueDate = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);
        const inv = await Invoice.create({
            org, number, kind: "invoice",
            customerName: r.customerName, customerAddress: r.customerAddress, customerTaxId: r.customerTaxId,
            contact: r.contact || undefined, company: r.company || undefined,
            items: applyTaxPolicy(r.items, settings), currency: r.currency, smallBusinessNote: !!settings.smallBusiness,
            issueDate: today, dueDate, notes: r.notes, recurringSource: r._id, template: r.template,
            status: r.autoSend ? "sent" : "draft", sentAt: r.autoSend ? new Date() : undefined,
            createdByName: "Automation",
        });
        await emit(org, { type: "invoice_recurring_created", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName } });
        if (r.autoSend) await emit(org, { type: "invoice_sent", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName, dealId: "" } });
        await logAudit({
            org, userName: "Automation", action: "invoice.recurring_created", entityType: "invoice", entityId: String(inv._id),
            summary: `Recurring invoice ${inv.number} generated for ${inv.customerName}`, meta: { recurringId: String(r._id), autoSent: !!r.autoSend },
        });
        r.nextRunDate = advance(r.nextRunDate, r.interval as "monthly" | "yearly", r.dayOfMonth);
        r.lastRunAt = new Date();
        r.lastInvoice = inv._id;
        await r.save();
        created++;
    }
    return created;
}
