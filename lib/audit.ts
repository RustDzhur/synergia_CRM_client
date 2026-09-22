import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

// Записать финансово значимое действие (ТЗ §85). Best-effort и никогда не блокирует/не роняет саму операцию —
// как и лог автоматизации (lib/automation/index.ts): если писать некуда, действие всё равно должно пройти.
export async function logAudit(params: {
    org: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    meta?: Record<string, unknown>;
}) {
    try {
        const user = await User.findById(params.userId).select("firstname lastname");
        const userName = user ? `${user.firstname} ${user.lastname}`.trim() : "";
        await AuditLog.create({
            org: params.org, userId: params.userId, userName,
            action: params.action, entityType: params.entityType, entityId: params.entityId,
            summary: params.summary, meta: params.meta ?? {},
        });
    } catch (e) {
        console.error("audit log failed", e);
    }
}
