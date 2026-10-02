import { prisma } from "@/lib/prisma";
import { toDTOs } from "@/lib/serialize";

// Колонки доски сделок пользователя; при первом заходе создаются 6 колонок по умолчанию, первая — «New Lead»
export const DEFAULT_STAGE_NAMES = ["New Lead", "Contacted", "Qualified", "Proposal", "Negotiation", "Won"];

export async function ensureStages(owner: string) {
    const stages = await prisma.stage.findMany({ where: { owner }, orderBy: { order: "asc" } });
    if (stages.length) return toDTOs(stages);
    await prisma.stage.createMany({ data: DEFAULT_STAGE_NAMES.map((name, order) => ({ owner, name, order })) });
    return toDTOs(await prisma.stage.findMany({ where: { owner }, orderBy: { order: "asc" } }));
}
