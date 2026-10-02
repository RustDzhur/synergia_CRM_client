import { prisma } from "@/lib/prisma";
import { financeSettings } from "./settings";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { computeTotals } from "./totals";
import { type DunningMail, emailDunning } from "./dunningMail";

// Манаведение (Mahnwesen): ступени напоминаний по просроченному счёту.
// Ступень повышается вручную или автоматическим обходом (lib/finance/reminders.ts), каждая ступень
// добавляет свой сбор и даёт клиенту новый короткий срок оплаты. Проценты за просрочку считаются
// справочно и в счёт не включаются: их ставка зависит от договора и базовой ставки Бундесбанка,
// поэтому окончательное решение оставляем бухгалтеру.

export const DUNNING_LEVELS = [1, 2, 3, 4] as const;
export type DunningLevel = (typeof DUNNING_LEVELS)[number];

// Ключи подписей ступеней в messages (namespace finance): level_1 … level_4
export const dunningKey = (level: number) => `level_${Math.min(4, Math.max(1, level))}`;

export interface DunningState {
    level: number;          // текущая ступень (0 — напоминаний не было)
    nextLevel: DunningLevel | 0; // что будет при следующем напоминании, 0 — выше некуда
    fee: number;            // накопленные сборы
    appliesFee: number;     // сбор, который добавится при следующем напоминании
    overduDays: number;     // на сколько дней просрочен
    interest: number;       // проценты за просрочку (справочно), 0 если ставка не задана
    paymentDueDate: string; // новый срок оплаты, если отправить напоминание сегодня
}

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const round2 = (n: number) => Math.round(n * 100) / 100;

// Сбор за ступень из настроек; вне диапазона — 0
export const feeForLevel = (fees: number[] | undefined, level: number) =>
    round2(Math.max(0, Number(fees?.[level] ?? 0) || 0));

// Дней просрочки на дату. Счёт без срока оплаты просроченным не считается.
export function daysOverdue(dueDate: string, today = new Date()): number {
    if (!dueDate) return 0;
    const due = new Date(`${dueDate}T00:00:00.000Z`);
    if (Number.isNaN(due.getTime())) return 0;
    return Math.max(0, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - due.getTime()) / DAY));
}

// Проценты за просрочку: сумма счёта × ставка × дни / 365. Считается только если ставка задана в настройках.
export function interestFor(gross: number, rate: number, days: number): number {
    if (!rate || !days) return 0;
    return round2(gross * (rate / 100) * (days / 365));
}

// Состояние манаведения для счёта — то, что показывает интерфейс и кладёт в PDF
export async function dunningState(org: string, inv: any, today = new Date()): Promise<DunningState> {
    const s = await financeSettings(org);
    const level = Number(inv.dunningLevel) || 0;
    const next = (DUNNING_LEVELS.find((l) => l > level) ?? 0) as DunningLevel | 0;
    const overdue = daysOverdue(inv.dueDate ?? "", today);
    const totals = computeTotals(inv.items ?? [], { exempt: !!inv.smallBusinessNote });
    const rate = Number(s.dunningInterestRate) || 0;
    const paymentDays = Number(s.dunningPaymentDays) || 7;
    return {
        level,
        nextLevel: next,
        fee: round2(inv.dunningFee ?? 0),
        appliesFee: next ? feeForLevel(s.dunningFees as number[], next) : 0,
        overduDays: overdue,
        interest: interestFor(totals.gross + (inv.dunningFee ?? 0), rate, overdue),
        paymentDueDate: iso(new Date(today.getTime() + paymentDays * DAY)),
    };
}

// Отправка напоминания: поднимает ступень, начисляет сбор, пишет историю и отдаёт событие автоматизации
// и отправляет клиенту письмо с PDF счёта из ящика фирмы (если у фирмы нет своего правила «письмо» на invoice_reminder).
export async function sendDunning(org: string, invoiceId: string, byName: string, locale?: string): Promise<{ ok: true; level: number; fee: number; mail: DunningMail; to?: string } | { ok: false; message: string }> {
    const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, org } });
    if (!inv) return { ok: false, message: "Invoice not found" };
    if (inv.kind !== "invoice") return { ok: false, message: "Only invoices can be reminded" };
    if (inv.status === "paid") return { ok: false, message: "This invoice is already paid" };
    if (inv.status === "cancelled") return { ok: false, message: "This invoice is cancelled" };
    if (!inv.dueDate) return { ok: false, message: "The invoice has no due date" };

    const state = await dunningState(org, inv);
    if (!state.nextLevel) return { ok: false, message: "The highest reminder level is already reached" };

    const settings = await financeSettings(org);
    const fee = feeForLevel(settings.dunningFees as number[], state.nextLevel);
    const level = state.nextLevel;

    const dunningLog = [...((inv.dunningLog as any[]) ?? []), { level, sentAt: new Date().toISOString(), fee, dueDate: state.paymentDueDate, method: "manual" }];
    await prisma.invoice.update({
        where: { id: inv.id },
        data: {
            dunningLevel: level,
            dunningFee: round2((Number(inv.dunningFee) || 0) + fee),
            lastReminderAt: new Date(),
            status: "overdue",
            reminderCount: (Number(inv.reminderCount) || 0) + 1,
            dunningLog: dunningLog as any,
        },
    });

    await emit(org, { type: "invoice_reminder", data: { id: inv.id, number: inv.number, customerName: inv.customerName, level: String(level), fee: fee ? String(fee) : "" } });
    await logAudit({
        org, userName: byName || "—", action: "invoice.dunning_sent", entityType: "invoice", entityId: inv.id,
        summary: `Reminder level ${level} sent for invoice ${inv.number}${fee ? ` (fee ${fee})` : ""}`,
    });
    const mail = await emailDunning(org, invoiceId, level, state.paymentDueDate, locale);
    return { ok: true, level, fee, mail: mail.status, to: mail.to };
}
