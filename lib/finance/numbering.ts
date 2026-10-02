import { prisma } from "@/lib/prisma";

// Следующий номер документа без пропусков и повторов: «{prefix}-{год}-{порядковый с начала года}», например «RE-2026-1».
// Счётчик лежит в Json-поле counters (раньше — атомарный $inc в Mongoose; здесь read-modify-write: для
// одной фирмы с редкими одновременными запросами этого достаточно).
export async function nextNumber(org: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const key = `${prefix}-${year}`;
    let s = await prisma.financeSettings.findUnique({ where: { org } });
    if (!s) s = await prisma.financeSettings.create({ data: { org } }).catch(() => prisma.financeSettings.findUnique({ where: { org } }));
    const counters = (s!.counters as Record<string, number> | null) ?? {};
    const seq = (counters[key] ?? 0) + 1;
    counters[key] = seq;
    await prisma.financeSettings.update({ where: { org }, data: { counters } });
    return `${key}-${seq}`;
}
