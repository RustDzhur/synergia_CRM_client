import Stage from "@/models/Stage";

// Колонки доски сделок пользователя; при первом заходе создаются 6 колонок по умолчанию, первая — «New Lead»
export const DEFAULT_STAGE_NAMES = ["New Lead", "Contacted", "Qualified", "Proposal", "Negotiation", "Won"];

export async function ensureStages(owner: string) {
    const stages = await Stage.find({ owner }).sort({ order: 1 });
    if (stages.length) return stages;
    return Stage.insertMany(DEFAULT_STAGE_NAMES.map((name, order) => ({ owner, name, order })));
}
