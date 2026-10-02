import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { assertProducts, postStockDoc, type StockDocKind } from "@/lib/finance/stockDocs";
import { logAudit } from "@/lib/audit";
import StockDoc from "@/models/StockDoc";
import Product from "@/models/Product";
import User from "@/models/User";
import Warehouse from "@/models/Warehouse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Документы склада (ТЗ §12): GET — журнал, POST — провести документ.
// Виды: приход, расход, перемещение, списание, оприбуткування излишков, инвентаризация.
// Инвентаризация приходит строками «товар, по факту» — расхождения против учёта превращаются в
// документы (излишки/недостача), и это видно в ответе, а не остаётся «где-то в голове».

const KINDS: StockDocKind[] = ["receipt", "issue", "transfer", "writeoff", "surplus", "inventory"];

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const list = await StockDoc.find({ org: user.id }).sort({ createdAt: -1 }).limit(limit);
    const [warehouses, products] = await Promise.all([
        Warehouse.find({ org: user.id }).select("name"),
        Product.find({ _id: { $in: list.flatMap((d) => d.lines.map((l: { product: unknown }) => l.product)) } }).select("name sku unit"),
    ]);
    const wName = new Map(warehouses.map((w) => [String(w._id), w.name]));
    const pInfo = new Map(products.map((p) => [String(p._id), { name: p.name, sku: p.sku ?? "", unit: p.unit ?? "" }]));
    return NextResponse.json(
        list.map((d) => ({
            id: String(d._id),
            kind: d.kind,
            number: d.number,
            date: d.date,
            warehouseFrom: d.warehouseFrom ? wName.get(String(d.warehouseFrom)) ?? "" : "",
            warehouseTo: d.warehouseTo ? wName.get(String(d.warehouseTo)) ?? "" : "",
            note: d.note ?? "",
            by: d.by ?? "",
            reversed: !!d.reversedBy,
            reversalOf: d.reversalOf ? String(d.reversalOf) : "",
            lines: (d.lines ?? []).map((l: { product: unknown; qty: number; price?: number; diff?: number }) => ({
                product: String(l.product),
                name: pInfo.get(String(l.product))?.name ?? "",
                sku: pInfo.get(String(l.product))?.sku ?? "",
                unit: pInfo.get(String(l.product))?.unit ?? "",
                qty: l.qty,
                price: l.price ?? 0,
                // инвентаризация: расхождение с учётом (плюс — излишек, минус — недостача)
                diff: l.diff ?? 0,
            })),
        }))
    );
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const kind = String(b?.kind ?? "") as StockDocKind;
    if (!KINDS.includes(kind)) return badRequest("kind must be one of: " + KINDS.join(", "));
    try {
        await connectDB();
        const author = await User.findById(user.userId).select("firstname lastname");
        const lines = Array.isArray(b?.lines) ? b.lines : [];
        if (!lines.length) return badRequest("У документі немає рядків");
        await assertProducts(user.id, lines.map((l: { product?: string }) => String(l?.product ?? "")));
        const doc = await postStockDoc(user.id, {
            kind,
            date: typeof b?.date === "string" ? b.date : undefined,
            warehouseFrom: typeof b?.warehouseFrom === "string" ? b.warehouseFrom : undefined,
            warehouseTo: typeof b?.warehouseTo === "string" ? b.warehouseTo : undefined,
            lines: lines.map((l: { product: string; qty: unknown; price?: unknown; note?: string }) => ({ product: l.product, qty: Number(l.qty) || 0, price: Number(l.price) || 0, note: l.note })),
            note: typeof b?.note === "string" ? b.note : "",
            by: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        });
        await logAudit({ org: user.id, userId: user.userId, action: `stock.${kind}`, entityType: "stock_doc", entityId: String(doc.id), summary: `Stock document ${doc.number} posted (${lines.length} lines)`, meta: { kind } });
        return NextResponse.json({ id: String(doc.id), number: doc.number }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
