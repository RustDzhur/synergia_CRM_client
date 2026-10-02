import { nextNumber } from "./numbering";
import { financeSettings } from "./settings";
import { applyTaxPolicy } from "./tax";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// Следующая дата запуска: тот же день месяца в следующем периоде (monthly/yearly), обрезанный до последнего дня
// месяца, если dayOfMonth в нём не существует.
function advance(dateStr: string, interval: "monthly" | "yearly", dayOfMonth: number): string {
    const d = new Date(dateStr + "T00:00:00.000Z");
    if (interval === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dayOfMonth, lastDay));
    return d.toISOString().slice(0, 10);
}

// Крон (app/api/cron/automation): находит шаблоны с nextRunDate <= сегодня и создаёт из каждого новый Invoice —
// черновик на проверку или сразу отправленный счёт (autoSend). Дальше сдвигает nextRunDate на следующий период.
export async function runRecurringInvoices() {
    const today = new Date().toISOString().slice(0, 10);
    const due = await prisma.recurringInvoice.findMany({ where: { active: true, nextRunDate: { lte: today } } });
    let created = 0;
    for (const r of due) {
        const org = String(r.org);
        const settings = await financeSettings(org);
        const number = await nextNumber(org, settings.invoicePrefix || "RE");
        const dueDate = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);
        const inv = await prisma.invoice.create({
            data: {
                org, number, kind: "invoice",
                customerName: r.customerName, customerAddress: r.customerAddress, customerTaxId: r.customerTaxId,
                contact: r.contact || undefined, company: r.company || undefined,
                items: applyTaxPolicy(r.items as any, settings) as any, currency: r.currency, smallBusinessNote: !!settings.smallBusiness,
                issueDate: today, dueDate, notes: r.notes, recurringSource: r.id, template: (r as any).template ?? "",
                status: r.autoSend ? "sent" : "draft", sentAt: r.autoSend ? new Date() : undefined,
                createdByName: "Automation",
            },
        });
        await emit(org, { type: "invoice_recurring_created", data: { id: inv.id, number: inv.number, customerName: inv.customerName } });
        if (r.autoSend) await emit(org, { type: "invoice_sent", data: { id: inv.id, number: inv.number, customerName: inv.customerName, dealId: "" } });
        await logAudit({
            org, userName: "Automation", action: "invoice.recurring_created", entityType: "invoice", entityId: inv.id,
            summary: `Recurring invoice ${inv.number} generated for ${inv.customerName}`, meta: { recurringId: r.id, autoSent: !!r.autoSend },
        });
        await prisma.recurringInvoice.update({
            where: { id: r.id },
            data: { nextRunDate: advance(r.nextRunDate, r.interval as "monthly" | "yearly", Number(r.dayOfMonth) || 1), lastRunAt: new Date(), lastInvoice: inv.id },
        });
        created++;
    }
    return created;
}
