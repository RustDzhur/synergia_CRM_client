import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import Bom from "@/models/Bom";
import Product from "@/models/Product";

export const dynamic = "force-dynamic";

// Спецификации (BOM, ТЗ §13): список и сохранение. Сохранение поднимает версию: старые заказы ссылаются
// на свою версию и продолжают считаться по ней, новые берут последнюю активную.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const list = await Bom.find({ org: user.id }).sort({ updatedAt: -1 });
    const ids = new Set<string>();
    for (const b of list) {
        ids.add(String(b.product));
        for (const c of b.components ?? []) ids.add(String(c.product));
    }
    const products = await Product.find({ _id: { $in: Array.from(ids) } }).select("name sku unit type");
    const info = new Map(products.map((p) => [String(p._id), { name: p.name, sku: p.sku ?? "", unit: p.unit ?? "", type: p.type }]));
    return NextResponse.json(
        list.map((b) => ({
            id: String(b._id),
            product: String(b.product),
            productName: info.get(String(b.product))?.name ?? "",
            productUnit: info.get(String(b.product))?.unit ?? "",
            name: b.name ?? "",
            version: b.version ?? 1,
            active: !!b.active,
            overheadPercent: b.overheadPercent ?? 0,
            note: b.note ?? "",
            components: (b.components ?? []).map((c: { product: unknown; qty: number; wastePercent?: number; optional?: boolean; note?: string }) => ({
                product: String(c.product),
                name: info.get(String(c.product))?.name ?? "",
                sku: info.get(String(c.product))?.sku ?? "",
                unit: info.get(String(c.product))?.unit ?? "",
                qty: c.qty,
                wastePercent: c.wastePercent ?? 0,
                optional: !!c.optional,
                note: c.note ?? "",
            })),
            operations: (b.operations ?? []).map((o: { name: string; minutes: number; costPerHour: number; workCenter?: string }) => ({ name: o.name, minutes: o.minutes, costPerHour: o.costPerHour, workCenter: o.workCenter ?? "" })),
            outputs: (b.outputs ?? []).map((o: { product: unknown; qty: number }) => ({ product: String(o.product), name: info.get(String(o.product))?.name ?? "", qty: o.qty })),
        }))
    );
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const product = String(b?.product ?? "");
    if (!product) return badRequest("product is required");
    const components = (Array.isArray(b?.components) ? b.components : []).filter((c: { product?: string; qty?: unknown }) => c?.product && Number(c?.qty) > 0);
    const operations = (Array.isArray(b?.operations) ? b.operations : []).filter((o: { name?: string }) => o?.name?.trim());
    if (!components.length && !operations.length) return badRequest("specification is empty");
    await connectDB();
    const target = await Product.findOne({ _id: product, org: user.id });
    if (!target) return badRequest("product not found");

    // Новая версия вместо правки: старые заказы не должны измениться задним числом
    const latest = await Bom.findOne({ org: user.id, product }).sort({ version: -1 });
    const id = String(b?.id ?? "");
    const version = latest ? (String(latest._id) === id ? latest.version : (latest.version ?? 1) + 1) : 1;
    const doc = id && String(latest?._id) === id && latest
        ? latest
        : await Bom.create({ org: user.id, product, version });
    doc.set({
        name: String(b?.name ?? "").slice(0, 120),
        active: true,
        components: components.map((c: { product: string; qty: unknown; wastePercent?: unknown; optional?: boolean; note?: string }) => ({
            product: c.product,
            qty: Math.abs(Number(c.qty)),
            wastePercent: Math.max(0, Math.min(100, Number(c.wastePercent) || 0)),
            optional: !!c.optional,
            note: String(c.note ?? "").slice(0, 200),
        })),
        operations: operations.map((o: { name: string; minutes?: unknown; costPerHour?: unknown; workCenter?: string }) => ({
            name: String(o.name).slice(0, 120),
            minutes: Math.max(0, Number(o.minutes) || 0),
            costPerHour: Math.max(0, Number(o.costPerHour) || 0),
            workCenter: String(o.workCenter ?? "").slice(0, 120),
        })),
        outputs: (Array.isArray(b?.outputs) ? b.outputs : []).filter((o: { product?: string; qty?: unknown }) => o?.product && Number(o?.qty) > 0).map((o: { product: string; qty: unknown }) => ({ product: o.product, qty: Math.abs(Number(o.qty)) })),
        overheadPercent: Math.max(0, Math.min(300, Number(b?.overheadPercent) || 0)),
        note: String(b?.note ?? "").slice(0, 600),
    });
    doc.markModified("components");
    doc.markModified("operations");
    doc.markModified("outputs");
    await doc.save();
    return NextResponse.json({ id: String(doc._id), version: doc.version }, { status: 201 });
}

export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const id = String(b?.id ?? "");
    await connectDB();
    const doc = await Bom.findOne({ _id: id, org: user.id });
    if (!doc) return badRequest("not found");
    if (typeof b.active === "boolean") doc.active = b.active;
    await doc.save();
    return NextResponse.json({ ok: true });
}
