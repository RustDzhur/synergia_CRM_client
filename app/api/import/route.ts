import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import/kinds";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/import — что мастеру импорта нужно знать до загрузки файла: описание полей каждого вида
// (подписи, обязательные, проверки) и история пакетов с возможностью отката.

 export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const [batches, mappings] = await Promise.all([
        prisma.importBatch.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
        prisma.importMapping.findMany({ where: { org: user.id }, orderBy: { updatedAt: "desc" }, take: 50 }),
    ]);
    return NextResponse.json({
        kinds: Object.values(IMPORT_KINDS).map((d) => ({ kind: d.kind, label: d.label, fields: d.fields.map((f) => ({ key: f.key, label: f.label, required: !!f.required, code: f.code ?? "" })) })),
        batches: batches.map((b) => ({
            id: b.id,
            kind: b.kind,
            fileName: b.fileName,
            by: b.by,
            at: b.createdAt,
            rolledBackAt: b.rolledBackAt,
            summary: b.summary,
            // Полный журнал пакета отдаём отдельно — в списке он не нужен
            failedRows: ((b.log ?? []) as any[]).filter((l: { status: string }) => l.status === "failed").slice(0, 20).map((l: { row: number; message: string }) => ({ row: l.row, message: l.message })),
        })),
        mappings: mappings.map((m) => ({ id: m.id, kind: m.kind, name: m.name, mapping: m.mapping })),
    });
}

// POST /api/import — { action: "save-mapping", kind, name, mapping } — сохранить шаблон сопоставления
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    if (b?.action !== "save-mapping") return badRequest('action must be "save-mapping"');
    const kind = String(b.kind ?? "") as ImportKind;
    if (!IMPORT_KINDS[kind]) return badRequest("unknown import kind");
    const name = String(b.name ?? "").trim().slice(0, 80);
    if (!name) return badRequest("name is required");
    const mapping = typeof b.mapping === "object" && b.mapping ? b.mapping : {};
    const existing = await prisma.importMapping.findFirst({ where: { org: user.id, kind, name } });
    const doc = existing
        ? await prisma.importMapping.update({ where: { id: existing.id }, data: { mapping: mapping as any } })
        : await prisma.importMapping.create({ data: { org: user.id, kind, name, mapping: mapping as any } });
    return NextResponse.json({ id: doc.id, kind, name });
}
