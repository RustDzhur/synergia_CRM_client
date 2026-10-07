import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { recordSyncError } from "@/lib/sync/errors";

// Лента активности сделки, контакта, фирмы и задачи: Json-массив activities в самой записи.
// Запись сюда — единственный путь для событий, пришедших не от человека (оплата, счёт, договор, смена этапа, задача):
// карточка клиента должна показывать всё, что с ним произошло, как бы это ни было сделано.
//
// Добавление — одним оператором UPDATE (jsonb ||), поэтому две записи одновременно не затирают друг друга
// (раньше читали массив, дописывали и писали обратно). key делает запись идемпотентной: повтор события
// (повторный webhook, второй клик) с тем же key ничего не добавляет.

export type FeedTarget = "deal" | "contact" | "company" | "task";
const TABLE: Record<FeedTarget, string> = { deal: "deals", contact: "contacts", company: "companies", task: "tasks" };

export type FeedKind = "payment" | "invoice" | "quote" | "contract" | "order" | "expense" | "won" | "task" | "note" | "stage";

export interface FeedEntry {
    type: FeedKind;
    text: string;
    meta?: string; // например "invoice:<id>" — по нему интерфейс может сделать ссылку
    key?: string; // ключ идемпотентности
}

export type FeedTargets = Partial<Record<FeedTarget, string | null | undefined>>;

async function append(target: FeedTarget, id: string, owner: string, entry: FeedEntry): Promise<boolean> {
    const doc = { _id: randomUUID(), type: entry.type, text: entry.text.slice(0, 2000), meta: (entry.meta ?? "").slice(0, 100), createdAt: new Date().toISOString(), ...(entry.key ? { key: entry.key } : {}) };
    const table = Prisma.raw(`"${TABLE[target]}"`);
    const add = JSON.stringify([doc]);
    const probe = JSON.stringify([{ key: entry.key ?? "" }]);
    const count = await prisma.$executeRaw`
        UPDATE ${table}
        SET "activities" = COALESCE("activities"::jsonb, '[]'::jsonb) || ${add}::jsonb
        WHERE "id" = ${id} AND "owner" = ${owner}
        AND (${entry.key ? 1 : 0}::int = 0 OR NOT (COALESCE("activities"::jsonb, '[]'::jsonb) @> ${probe}::jsonb))`;
    return count > 0;
}

// Записывает событие во все указанные карточки фирмы. Не бросает исключений: лента — вспомогательный след,
// сбой не должен отменять основное действие; сбой фиксируется в журнале (lib/sync/errors.ts).
export async function logActivity(owner: string, targets: FeedTargets, entry: FeedEntry): Promise<void> {
    for (const [target, id] of Object.entries(targets) as [FeedTarget, string | null | undefined][]) {
        if (!id) continue;
        try {
            await append(target, id, owner, entry.key ? { ...entry, key: `${entry.key}:${target}` } : entry);
        } catch (e) {
            await recordSyncError(owner, `feed.${target}`, e, { id, type: entry.type });
        }
    }
}
