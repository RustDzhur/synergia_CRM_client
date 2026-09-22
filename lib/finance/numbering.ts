import FinanceSettings from "@/models/FinanceSettings";

// Следующий номер документа без пропусков и повторов: «{prefix}-{год}-{порядковый с начала года}», например «RE-2026-1».
// Атомарный $inc на счётчике в FinanceSettings — два одновременных запроса никогда не получат один и тот же номер.
export async function nextNumber(org: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const key = `${prefix}-${year}`;
    const doc = await FinanceSettings.findOneAndUpdate({ org }, { $inc: { [`counters.${key}`]: 1 } }, { upsert: true, new: true });
    const seq = (doc.counters as unknown as Map<string, number>).get(key) ?? 1;
    return `${key}-${seq}`;
}
