import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

// Записать финансово значимое действие (ТЗ §85). Best-effort и никогда не блокирует/не роняет саму операцию —
// как и лог автоматизации (lib/automation/index.ts): если писать некуда, действие всё равно должно пройти.
export async function logAudit(params: {
    org: string;
    userId?: string; // не указан — системное действие (крон); тогда обязателен userName
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    meta?: Record<string, unknown>;
    userName?: string; // готовое имя (например «Automation») — пропускает поиск пользователя, для системных действий без userId
}) {
    try {
        let userName = params.userName ?? "";
        if (params.userName === undefined && params.userId) {
            const user = await User.findById(params.userId).select("firstname lastname");
            userName = user ? `${user.firstname} ${user.lastname}`.trim() : "";
        }
        await AuditLog.create({
            org: params.org, ...(params.userId ? { userId: params.userId } : {}), userName,
            action: params.action, entityType: params.entityType, entityId: params.entityId,
            summary: params.summary, meta: params.meta ?? {},
        });
    } catch (e) {
        console.error("audit log failed", e);
    }
}
