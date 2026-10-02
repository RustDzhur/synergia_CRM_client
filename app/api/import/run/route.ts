import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import/kinds";
import { applyImport, previewImport } from "@/lib/import/engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/import/run — { kind, text, mapping?, fileName?, dryRun? }: импорт файла.
// dryRun = true — только отчёт, без записи (для больших файлов окно показывает его перед подтверждением).
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const kind = String(b?.kind ?? "") as ImportKind;
    if (!IMPORT_KINDS[kind]) return badRequest("unknown import kind");
    const text = typeof b?.text === "string" ? b.text : "";
    if (!text.trim()) return badRequest("file is empty");
    const mapping = b?.mapping && typeof b.mapping === "object" ? (b.mapping as Record<string, string>) : undefined;

    const preview = previewImport(kind, text, mapping);
    if (preview.missingRequired.length) return badRequest(`required fields are not mapped: ${preview.missingRequired.join(", ")}`);
    if (b?.dryRun) {
        return NextResponse.json({ dryRun: true, summary: preview.summary, missingRequired: preview.missingRequired, errors: preview.rows.filter((r) => r.errors.length).slice(0, 50).map((r) => ({ row: r.line, errors: r.errors })) });
    }

    try {
        const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const report = await applyImport(user.id, preview, {
            fileName: typeof b?.fileName === "string" ? b.fileName.slice(0, 200) : "",
            by: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        });
        return NextResponse.json(report, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
