import { prisma } from "@/lib/prisma";

// Следующий номер документа без пропусков и повторов: «{prefix}-{год}-{порядковый с начала года}», например «RE-2026-1».
// Счётчик лежит в Json-поле counters. Увеличение — одним оператором UPDATE ... RETURNING: строку фирмы база блокирует
// на время оператора, поэтому два одновременных запроса получают разные номера (раньше счётчик читался и записывался
// отдельно, и параллельные запросы получали один и тот же номер — для счетов это нарушение сплошной нумерации).
export async function nextNumber(org: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const key = `${prefix}-${year}`;
    // строка настроек фирмы нужна до увеличения; параллельное создание второго экземпляра безвредно (org уникален)
    await prisma.financeSettings.upsert({ where: { org }, create: { org }, update: {} }).catch(() => undefined);
    const rows = await prisma.$queryRaw<{ seq: number }[]>`
        UPDATE "financesettings"
        SET "counters" = jsonb_set(COALESCE("counters"::jsonb, '{}'::jsonb), ARRAY[${key}::text], to_jsonb(COALESCE(("counters"::jsonb ->> ${key}::text)::int, 0) + 1)),
            "updatedAt" = NOW()
        WHERE "org" = ${org}
        RETURNING ("counters"::jsonb ->> ${key}::text)::int AS seq`;
    const seq = rows[0]?.seq;
    if (!seq) throw new Error("Document counter was not updated");
    return `${key}-${seq}`;
}
