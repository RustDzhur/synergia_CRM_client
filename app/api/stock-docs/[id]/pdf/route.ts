import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { pdfLocale } from "@/lib/finance/document";
import { marketOf } from "@/lib/finance/market";
import { financeSettings } from "@/lib/finance/settings";
import { stockDocPdfBuffer } from "@/lib/finance/stockDocPdf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/stock-docs/:id/pdf?locale= — печать складского документа: строки, склады, подписи
// сдал/принял; у инвентаризации — учёт, факт и расхождение.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return notFound();
        const doc = await prisma.stockDoc.findFirst({ where: { id: params.id, org: user.id } });
        if (!doc) return notFound();

        let buffer: Buffer;
        try {
            const productIds = Array.from(new Set(((doc.lines ?? []) as any[]).map((l) => String(l.product))));
            const [products, warehouses, settings] = await Promise.all([
                productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true, unit: true } }) : [],
                prisma.warehouse.findMany({ where: { org: user.id }, select: { id: true, name: true } }),
                financeSettings(user.id),
            ]);
            const pInfo = new Map(products.map((p) => [p.id, p]));
            const wName = new Map(warehouses.map((w) => [w.id, w.name]));
            buffer = await stockDocPdfBuffer(
                {
                    number: doc.number,
                    kind: doc.kind,
                    date: doc.date,
                    warehouseFrom: doc.warehouseFrom ? wName.get(String(doc.warehouseFrom)) ?? "" : "",
                    warehouseTo: doc.warehouseTo ? wName.get(String(doc.warehouseTo)) ?? "" : "",
                    note: doc.note ?? "",
                    by: doc.by ?? "",
                    reversed: !!doc.reversedBy,
                    lines: ((doc.lines ?? []) as any[]).map((l: { product: unknown; qty: number; price?: number; diff?: number }) => ({
                        name: pInfo.get(String(l.product))?.name ?? "",
                        sku: pInfo.get(String(l.product))?.sku ?? "",
                        unit: pInfo.get(String(l.product))?.unit ?? "",
                        qty: l.qty,
                        price: l.price ?? 0,
                        diff: l.diff ?? 0,
                    })),
                },
                { legalName: settings.legalName ?? "", address: settings.address ?? "", taxId: settings.taxId ?? "", market: marketOf(settings.country) },
                pdfLocale(new URL(req.url).searchParams.get("locale"))
            );
        } catch (e) {
            // Причина рендера видна пользователю: молчаливое «Server error» не подсказывает ничего
            return NextResponse.json({ message: e instanceof Error ? e.message : "PDF render failed", code: "pdf" }, { status: 500 });
        }
        return new Response(new Uint8Array(buffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": contentDisposition(`${doc.number}.pdf`),
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
