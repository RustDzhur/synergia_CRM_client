import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId, contentDisposition } from "@/lib/api";
import { reportPdf } from "@/lib/ai/reportPdf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const L = {
    uk: { title: "Замовлення постачальнику", supplier: "Постачальник", date: "Дата", expected: "Очікується", status: "Статус", product: "Товар", sku: "Артикул", qty: "К-сть", unit: "Од.", price: "Ціна", sum: "Сума", total: "Разом", notes: "Примітка" },
    ru: { title: "Заказ поставщику", supplier: "Поставщик", date: "Дата", expected: "Ожидается", status: "Статус", product: "Товар", sku: "Артикул", qty: "Кол-во", unit: "Ед.", price: "Цена", sum: "Сумма", total: "Итого", notes: "Примечание" },
    de: { title: "Bestellung beim Lieferanten", supplier: "Lieferant", date: "Datum", expected: "Erwartet", status: "Status", product: "Artikel", sku: "Art.-Nr.", qty: "Menge", unit: "Einh.", price: "Preis", sum: "Summe", total: "Gesamt", notes: "Notiz" },
    en: { title: "Purchase order", supplier: "Supplier", date: "Date", expected: "Expected", status: "Status", product: "Product", sku: "SKU", qty: "Qty", unit: "Unit", price: "Price", sum: "Amount", total: "Total", notes: "Notes" },
} as const;

// GET /api/purchases/:id/pdf?locale= — заказ поставщику как PDF (просмотр, печать, отправка поставщику)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return notFound();
        const po = await prisma.purchaseOrder.findFirst({ where: { id: params.id, org: user.id } });
        if (!po) return notFound();
        const loc = new URL(req.url).searchParams.get("locale");
        const t = L[loc === "ua" || loc === "uk" ? "uk" : loc === "de" ? "de" : loc === "en" ? "en" : "ru"];
        const lines = ((po.lines ?? []) as { product: string; qty: number; price?: number }[]);
        const [supplier, products] = await Promise.all([
            po.supplier ? prisma.supplier.findFirst({ where: { id: String(po.supplier), org: user.id }, select: { name: true } }) : null,
            prisma.product.findMany({ where: { org: user.id, id: { in: lines.map((l) => String(l.product)) } }, select: { id: true, name: true, sku: true, unit: true } }),
        ]);
        const info = new Map(products.map((p) => [p.id, p]));
        let total = 0;
        const rows = lines.map((l) => {
            const p = info.get(String(l.product));
            const sum = Math.round((Number(l.qty) || 0) * (Number(l.price) || 0) * 100) / 100;
            total += sum;
            return [p?.name ?? "—", p?.sku || "—", l.qty, p?.unit || "", l.price ? `${l.price} ${po.currency}` : "—", sum ? `${sum} ${po.currency}` : "—"];
        });
        const sub = [`${t.supplier}: ${supplier?.name ?? "—"}`, `${t.date}: ${po.date}`, po.expectedDate ? `${t.expected}: ${po.expectedDate}` : "", `${t.status}: ${po.status}`].filter(Boolean).join("  ·  ");
        const pdf = await reportPdf({
            title: `${t.title} ${po.number}`, subtitle: sub, intro: po.notes ? `${t.notes}: ${po.notes}` : undefined,
            sections: [{ columns: [t.product, t.sku, t.qty, t.unit, t.price, t.sum], rows }, ...(total ? [{ heading: `${t.total}: ${Math.round(total * 100) / 100} ${po.currency}`, columns: [], rows: [] }] : [])],
            footer: "Firmspace CRM",
        });
        return new Response(pdf as unknown as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": contentDisposition(`${po.number}.pdf`), "cache-control": "private, no-store" } });
    } catch (e) {
        return failure(e);
    }
}
