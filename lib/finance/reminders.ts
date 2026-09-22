import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { financeSettings } from "./settings";
import Invoice from "@/models/Invoice";

// Напоминания об оплате: для каждого просроченного счёта — раз в reminderIntervalDays (настройка фирмы, по умолчанию
// 7 дней) от последнего напоминания (или от даты просрочки, если ещё не было ни одного). Само письмо клиенту шлёт
// правило автоматизации на событие invoice_reminder (send_email) — здесь только считаем, кому пора, и фиксируем факт.
export async function sweepPaymentReminders() {
    const overdue = await Invoice.find({ status: "overdue" }).select("org number customerName lastReminderAt reminderCount dueDate");
    const settingsCache = new Map<string, number>();
    let sent = 0;
    for (const inv of overdue) {
        const org = String(inv.org);
        let intervalDays: number = settingsCache.get(org) ?? 0;
        if (!intervalDays) {
            const s = await financeSettings(org);
            intervalDays = Number(s.reminderIntervalDays) || 7;
            settingsCache.set(org, intervalDays);
        }
        const since = inv.lastReminderAt ?? new Date(inv.dueDate + "T00:00:00.000Z");
        const dueForReminder = Date.now() - since.getTime() >= intervalDays * 86400000;
        if (!dueForReminder) continue;
        await Invoice.updateOne({ _id: inv._id }, { $set: { lastReminderAt: new Date() }, $inc: { reminderCount: 1 } });
        await emit(org, { type: "invoice_reminder", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName } });
        await logAudit({
            org, userName: "Automation", action: "invoice.reminder_sent", entityType: "invoice", entityId: String(inv._id),
            summary: `Payment reminder sent for invoice ${inv.number} (${inv.customerName})`,
        });
        sent++;
    }
    return sent;
}
