import { AsyncLocalStorage } from "node:async_hooks";

// Сторож закрытых периодов на уровне базы (подключается в lib/prisma.ts через $use). Стоит НИЖЕ маршрутов, поэтому его не обойти ни
// забытой проверкой в новом маршруте, ни из ИИ-инструмента, ни из фонового задания: любая запись счёта, расхода или банковской
// операции с датой в закрытом периоде отклоняется (PeriodLockedError → 423 в маршрутах, обёрнутых withPeriodLock / failure).
//
// В закрытом периоде разрешены только поля, которые не меняют учёт: отметки (ЭСФ, проверка), служебные данные чека, ссылки на
// оплату, напоминания. Сумма, строки, статус, клиент, дата — нельзя. Платёж, пришедший в ОТКРЫТОМ периоде по старому счёту,
// проводится через registerPayment: он сам проверяет дату платежа и открывает обход для обновления счёта (periodBypass).

export const periodBypass = new AsyncLocalStorage<{ reason: string }>();

type Spec = { dateField: string; free: string[] };
const SPECS: Record<string, Spec> = {
    Invoice: {
        dateField: "issueDate",
        free: ["esf", "review", "payLink", "fiscalId", "fiscalCode", "fiscalUrl", "fiscalAt", "fiscalError", "fiscalPayType", "fiscalReturnId", "fiscalReturnCode", "fiscalReturnUrl", "fiscalReturnAt", "fiscalReturnError",
            "sentAt", "sentTo", "lastReminderAt", "reminderCount", "dunningLevel", "dunningFee", "dunningLog", "updatedAt"],
    },
    Expense: { dateField: "date", free: ["esf", "review", "receipt", "notes", "updatedAt"] },
    BankTransaction: { dateField: "date", free: ["notes", "updatedAt"] },
};
const WRITES = new Set(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]);

const plain = (v: unknown): unknown => (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && "set" in (v as object) ? (v as { set: unknown }).set : v);
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "string" ? v.slice(0, 10) : "");

interface Params { model?: string; action: string; args?: any }
type Delegate = { findMany: (a: unknown) => Promise<any[]>; findFirst: (a: unknown) => Promise<any> };

export async function checkPeriodWrite(params: Params, prismaClient: Record<string, unknown>): Promise<void> {
    const spec = params.model ? SPECS[params.model] : undefined;
    if (!spec || !WRITES.has(params.action) || periodBypass.getStore()) return;
    const { assertPeriodOpen } = await import("./periodLock");
    const delegate = prismaClient[params.model!.charAt(0).toLowerCase() + params.model!.slice(1)] as Delegate;
    const args = params.args ?? {};

    // быстрый путь: в системе нет ни одного действующего закрытия — проверять нечего
    const any = await (prismaClient.periodLock as { count: (a: unknown) => Promise<number> }).count({ where: { reopenedAt: null } });
    if (!any) return;

    const rowsOf = async (where: unknown) => (await delegate.findMany({ where, select: { org: true, [spec.dateField]: true }, take: 2000 })) as Array<Record<string, unknown>>;

    if (params.action === "create" || params.action === "createMany") {
        const list = params.action === "create" ? [args.data] : Array.isArray(args.data) ? args.data : [args.data];
        for (const d of list) if (d?.org) await assertPeriodOpen(String(d.org), d[spec.dateField] ?? undefined);
        return;
    }
    if (params.action === "upsert") {
        const d = args.create;
        if (d?.org) await assertPeriodOpen(String(d.org), d[spec.dateField] ?? undefined);
        const rows = await rowsOf(args.where);
        for (const r of rows) await assertPeriodOpen(String(r.org), r[spec.dateField]);
        return;
    }
    const rows = await rowsOf(args.where);
    if (params.action === "delete" || params.action === "deleteMany") {
        for (const r of rows) await assertPeriodOpen(String(r.org), r[spec.dateField]);
        return;
    }
    // update / updateMany: строка в закрытом периоде допускает только «свободные» поля; новая дата тоже не должна попасть в закрытый период
    const data = (args.data ?? {}) as Record<string, unknown>;
    const keys = Object.keys(data);
    const onlyFree = keys.every((k) => spec.free.includes(k)) || (params.model === "Invoice" && keys.every((k) => spec.free.includes(k) || (k === "status" && plain(data.status) === "overdue")));
    for (const r of rows) {
        if (!onlyFree) await assertPeriodOpen(String(r.org), r[spec.dateField]);
        if (data[spec.dateField] !== undefined) await assertPeriodOpen(String(r.org), day(plain(data[spec.dateField])));
    }
}
