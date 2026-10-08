import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Таблицы из schema.prisma, которых нет в базе (схема не накатана). Пусто — всё на месте. */
export async function missingTables(): Promise<string[]> {
    const wanted = Prisma.dmmf.datamodel.models.map((m) => m.dbName ?? m.name);
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
    const have = new Set(rows.map((r) => r.table_name));
    return wanted.filter((t) => !have.has(t));
}
