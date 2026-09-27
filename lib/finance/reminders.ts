import Invoice from "@/models/Invoice";
import { financeSettings } from "./settings";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { feeForLevel, round2 } from "./dunning";

// Автоматический обход напоминаний: раз в reminderIntervalDays (настройка фирмы, по умолчанию 7 дней)
// от последнего напоминания — или от даты просрочки, если их ещё не было — поднимает ступень
// манаведения, начисляет сбор за неё и отдаёт событие invoice_reminder. Само письмо клиенту шлёт
// правило автоматизации фирмы на это событие: система не решает за неё, что писать клиенту.
//
// Ступени выше 4 (letzte Mahnung) автоматически не поднимаются: дальше начинается правовая стадия,
// и решение о ней принимает человек.

const MAX_AUTO_LEVEL = 4;

export async function sweepPaymentReminders() {
    const overdue = await Invoice.find({ status: "overdue" }).select("org number customerName lastReminderAt reminderCount dueDate dunningLevel dunningFee");
    const settingsCache = new Map<string, { interval: number; fees: number[] }>();
    let sent = 0;

    for (const inv of overdue) {
        const org = String(inv.org);
        let cached = settingsCache.get(org);
        if (!cached) {
            const s = await financeSettings(org);
            cached = { interval: Number(s.reminderIntervalDays) || 7, fees: (s.dunningFees as number[]) ?? [] };
            settingsCache.set(org, cached);
        }
        const level = Number(inv.dunningLevel) || 0;
        if (level >= MAX_AUTO_LEVEL) continue; // выше — только вручную

        const since = inv.lastReminderAt ?? new Date(`${inv.dueDate}T00:00:00.000Z`);
        if (Date.now() - since.getTime() < cached.interval * 86400000) continue;

        const nextLevel = level + 1;
        const fee = feeForLevel(cached.fees, nextLevel);
        const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

        await Invoice.updateOne(
            { _id: inv._id },
            {
                $set: { lastReminderAt: new Date(), dunningLevel: nextLevel, dunningFee: round2((inv.dunningFee ?? 0) + fee) },
                $inc: { reminderCount: 1 },
                $push: { dunningLog: { level: nextLevel, sentAt: new Date(), fee, dueDate: due, method: "auto" } },
            }
        );
        await emit(org, { type: "invoice_reminder", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName, level: String(nextLevel), fee: fee ? String(fee) : "" } });
        await logAudit({
            org, userName: "Automation", action: "invoice.reminder_sent", entityType: "invoice", entityId: String(inv._id),
            summary: `Payment reminder level ${nextLevel} sent for invoice ${inv.number} (${inv.customerName})${fee ? ` (fee ${fee})` : ""}`,
        });
        sent++;
    }
    return sent;
}
