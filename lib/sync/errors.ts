import { prisma } from "@/lib/prisma";

// Побочные эффекты (лента, уведомление, автоматизация, чек) не должны отменять основное действие — но и пропадать
// молча они не вправе. Сбой пишется в журнал действий (AuditLog, action "sync.error"): его видно в разделе «Журнал»
// и в админ-кабинете, а не только в консоли контейнера.
export async function recordSyncError(org: string, where: string, error: unknown, meta: Record<string, unknown> = {}) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sync] ${where} failed`, message);
    try {
        await prisma.auditLog.create({
            data: { org, userName: "System", action: "sync.error", entityType: where, entityId: String(meta.id ?? ""), summary: `${where}: ${message}`.slice(0, 500), meta: { ...meta, message: message.slice(0, 500) } as never },
        });
    } catch {
        /* журнал недоступен — остаётся запись в консоли */
    }
}
