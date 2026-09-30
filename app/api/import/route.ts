import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import/kinds";
import ImportBatch from "@/models/ImportBatch";
import ImportMapping from "@/models/ImportMapping";

export const dynamic = "force-dynamic";

// GET /api/import — что мастеру импорта нужно знать до загрузки файла: описание полей каждого вида
// (подписи, обязательные, проверки) и история пакетов с возможностью отката.

 export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const [batches, mappings] = await Promise.all([
        ImportBatch.find({ org: user.id }).sort({ createdAt: -1 }).limit(20),
        ImportMapping.find({ org: user.id }).sort({ updatedAt: -1 }).limit(50),
    ]);
    return NextResponse.json({
        kinds: Object.values(IMPORT_KINDS).map((d) => ({ kind: d.kind, label: d.label, fields: d.fields.map((f) => ({ key: f.key, label: f.label, required: !!f.required, code: f.code ?? "" })) })),
        batches: batches.map((b) => ({
            id: String(b._id),
            kind: b.kind,
            fileName: b.fileName,
            by: b.by,
            at: b.createdAt,
            rolledBackAt: b.rolledBackAt,
            summary: b.summary,
            // Полный журнал пакета отдаём отдельно — в списке он не нужен
            failedRows: (b.log ?? []).filter((l: { status: string }) => l.status === "failed").slice(0, 20).map((l: { row: number; message: string }) => ({ row: l.row, message: l.message })),
        })),
        mappings: mappings.map((m) => ({ id: String(m._id), kind: m.kind, name: m.name, mapping: m.mapping })),
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
    await connectDB();
    const doc = await ImportMapping.findOneAndUpdate({ org: user.id, kind, name }, { $set: { mapping } }, { upsert: true, new: true });
    return NextResponse.json({ id: String(doc._id), kind, name });
}
