import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Спецификации (BOM, ТЗ §13): список и сохранение. Сохранение поднимает версию: старые заказы ссылаются
// на свою версию и продолжают считаться по ней, новые берут последнюю активную.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await prisma.bom.findMany({ where: { org: user.id }, orderBy: { updatedAt: "desc" } });
    const ids = new Set<string>();
    for (const b of list) {
        ids.add(String(b.product));
        for (const c of (b.components as any[]) ?? []) ids.add(String(c.product));
    }
    const products = await prisma.product.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true, name: true, sku: true, unit: true, type: true } });
    const info = new Map(products.map((p) => [p.id, { name: p.name, sku: p.sku ?? "", unit: p.unit ?? "", type: p.type }]));
    return NextResponse.json(
        list.map((b) => ({
            id: b.id,
            product: b.product,
            productName: info.get(String(b.product))?.name ?? "",
            productUnit: info.get(String(b.product))?.unit ?? "",
            name: b.name ?? "",
            version: b.version ?? 1,
            active: !!b.active,
            overheadPercent: b.overheadPercent ?? 0,
            note: b.note ?? "",
            components: ((b.components as any[]) ?? []).map((c: { product: unknown; qty: number; wastePercent?: number; optional?: boolean; note?: string }) => ({
                product: String(c.product),
                name: info.get(String(c.product))?.name ?? "",
                sku: info.get(String(c.product))?.sku ?? "",
                unit: info.get(String(c.product))?.unit ?? "",
                qty: c.qty,
                wastePercent: c.wastePercent ?? 0,
                optional: !!c.optional,
                note: c.note ?? "",
            })),
            operations: ((b.operations as any[]) ?? []).map((o: { name: string; minutes: number; costPerHour: number; workCenter?: string }) => ({ name: o.name, minutes: o.minutes, costPerHour: o.costPerHour, workCenter: o.workCenter ?? "" })),
            outputs: ((b.outputs as any[]) ?? []).map((o: { product: unknown; qty: number }) => ({ product: String(o.product), name: info.get(String(o.product))?.name ?? "", qty: o.qty })),
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
    const target = await prisma.product.findFirst({ where: { id: product, org: user.id } });
    if (!target) return badRequest("product not found");

    // Новая версия вместо правки: старые заказы не должны измениться задним числом
    const latest = await prisma.bom.findFirst({ where: { org: user.id, product }, orderBy: { version: "desc" } });
    const id = String(b?.id ?? "");
    const version = latest ? (latest.id === id ? latest.version : (Number(latest.version) || 1) + 1) : 1;
    const doc = (id && latest?.id === id && latest) ? latest : await prisma.bom.create({ data: { org: user.id, product, version } });
    const updated = await prisma.bom.update({
        where: { id: doc.id },
        data: {
            name: String(b?.name ?? "").slice(0, 120),
            active: true,
            components: components.map((c: { product: string; qty: unknown; wastePercent?: unknown; optional?: boolean; note?: string }) => ({
                product: c.product,
                qty: Math.abs(Number(c.qty)),
                wastePercent: Math.max(0, Math.min(100, Number(c.wastePercent) || 0)),
                optional: !!c.optional,
                note: String(c.note ?? "").slice(0, 200),
            })) as any,
            operations: operations.map((o: { name: string; minutes?: unknown; costPerHour?: unknown; workCenter?: string }) => ({
                name: String(o.name).slice(0, 120),
                minutes: Math.max(0, Number(o.minutes) || 0),
                costPerHour: Math.max(0, Number(o.costPerHour) || 0),
                workCenter: String(o.workCenter ?? "").slice(0, 120),
            })) as any,
            outputs: (Array.isArray(b?.outputs) ? b.outputs : []).filter((o: { product?: string; qty?: unknown }) => o?.product && Number(o?.qty) > 0).map((o: { product: string; qty: unknown }) => ({ product: o.product, qty: Math.abs(Number(o.qty)) })) as any,
            overheadPercent: Math.max(0, Math.min(300, Number(b?.overheadPercent) || 0)),
            note: String(b?.note ?? "").slice(0, 600),
        },
    });
    return NextResponse.json({ id: updated.id, version: updated.version }, { status: 201 });
}

export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const id = String(b?.id ?? "");
    const doc = await prisma.bom.findFirst({ where: { id, org: user.id } });
    if (!doc) return badRequest("not found");
    if (typeof b.active === "boolean") await prisma.bom.update({ where: { id }, data: { active: b.active } });
    return NextResponse.json({ ok: true });
}
