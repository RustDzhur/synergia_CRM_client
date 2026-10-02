import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized, validId } from "@/lib/api";
import { rollbackImport } from "@/lib/import/engine";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/import/rollback — { batchId }: откатить пакет импорта (ТЗ §17 — «откат по номеру пакета»).
// Созданные записи удаляются, изменённые возвращаются к прежним значениям, движения склада гасятся
// обратными записями: журнал склада неизменяем, и это видно в отчёте.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const batchId = String(b?.batchId ?? "");
    if (!validId(batchId)) return badRequest("batchId is required");
    try {
            const result = await rollbackImport(user.id, batchId);
        if (!result.ok) return badRequest(result.message === "already_rolled_back" ? "Пакет вже відкочено" : "Пакет не знайдено");
        await logAudit({ org: user.id, userId: user.userId, action: "import.rollback", entityType: "import", entityId: batchId, summary: `Import batch ${batchId} rolled back`, meta: {} });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
