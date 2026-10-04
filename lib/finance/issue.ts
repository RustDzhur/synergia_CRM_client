import { prisma } from "@/lib/prisma";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Дата или период оказания услуги — обязательный реквизит немецкого счёта (§14 Abs. 4 Nr. 6 UStG). Счета, созданные без неё (раньше —
 * ассистентом и по API), нельзя было провести, а черновик уже не правится из списка. Если дата не задана, считаем, что услуга оказана
 * в день выставления счёта (самый частый случай, в PDF это так и печатается) и сохраняем её в счёте.
 */
export async function ensureSupplyDate<T extends { id: string; issueDate?: string | null; supplyDate?: string | null; supplyPeriodFrom?: string | null; supplyPeriodTo?: string | null }>(inv: T): Promise<T> {
    if (DATE.test(inv.supplyDate ?? "") || (DATE.test(inv.supplyPeriodFrom ?? "") && DATE.test(inv.supplyPeriodTo ?? ""))) return inv;
    const day = DATE.test(inv.issueDate ?? "") ? String(inv.issueDate) : new Date().toISOString().slice(0, 10);
    await prisma.invoice.update({ where: { id: inv.id }, data: { supplyDate: day, ...(DATE.test(inv.issueDate ?? "") ? {} : { issueDate: day }) } });
    return { ...inv, supplyDate: day, ...(DATE.test(inv.issueDate ?? "") ? {} : { issueDate: day }) };
}
