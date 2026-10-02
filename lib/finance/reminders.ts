import { prisma } from "@/lib/prisma";
import { financeSettings } from "./settings";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { feeForLevel, round2 } from "./dunning";
import { emailDunning } from "./dunningMail";

// Автоматический обход напоминаний: раз в reminderIntervalDays (настройка фирмы, по умолчанию 7 дней)
// от последнего напоминания — или от даты просрочки, если их ещё не было — поднимает ступень
// манаведения, начисляет сбор за неё и отдаёт событие invoice_reminder.
//
// Ступени выше 4 (letzte Mahnung) автоматически не поднимаются: дальше начинается правовая стадия,
// и решение о ней принимает человек.

const MAX_AUTO_LEVEL = 4;

export async function sweepPaymentReminders() {
    const overdue = await prisma.invoice.findMany({ where: { status: "overdue" }, select: { id: true, org: true, number: true, customerName: true, lastReminderAt: true, reminderCount: true, dueDate: true, dunningLevel: true, dunningFee: true, dunningLog: true } });
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

        const dunningLog = [...((inv.dunningLog as any[]) ?? []), { level: nextLevel, sentAt: new Date().toISOString(), fee, dueDate: due, method: "auto" }];
        await prisma.invoice.update({
            where: { id: inv.id },
            data: {
                lastReminderAt: new Date(),
                dunningLevel: nextLevel,
                dunningFee: round2((Number(inv.dunningFee) || 0) + fee),
                reminderCount: (Number(inv.reminderCount) || 0) + 1,
                dunningLog: dunningLog as any,
            },
        });
        await emit(org, { type: "invoice_reminder", data: { id: inv.id, number: inv.number, customerName: inv.customerName, level: String(nextLevel), fee: fee ? String(fee) : "" } });
        await emailDunning(org, inv.id, nextLevel, due);
        await logAudit({
            org, userName: "Automation", action: "invoice.reminder_sent", entityType: "invoice", entityId: inv.id,
            summary: `Payment reminder level ${nextLevel} sent for invoice ${inv.number} (${inv.customerName})${fee ? ` (fee ${fee})` : ""}`,
        });
        sent++;
    }
    return sent;
}
