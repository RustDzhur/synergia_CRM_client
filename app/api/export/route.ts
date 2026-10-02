import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { toCsv } from "@/lib/import/csv";
import { computeTotals } from "@/lib/finance/totals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/export?kind=products|contacts|companies|invoices|orders|quotes|expenses&format=csv|json|yml
//
// Экспорт любого списка (ТЗ §17): CSV и JSON — универсальные, YML — формат прайса для украинских
// маркетплейсов (Prom.ua, Rozetka принимают YML/XML). Экспорт ничего не меняет и не требует ключей:
// это тот же список, что видно в кабинете, только файлом.

const KINDS = ["products", "contacts", "companies", "invoices", "orders", "quotes", "expenses", "datev"] as const;
type Kind = (typeof KINDS)[number];

const esc = (v: unknown) => String(v ?? "");
const xmlEsc = (v: unknown) => esc(v).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") as Kind | null;
    if (!kind || !KINDS.includes(kind)) return badRequest("kind must be one of: " + KINDS.join(", "));
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
    // DATEV: выгрузка проводок (EXTF 700/21) для бухгалтера — номера счетов по умолчанию SKR03
    // (8400 выручка 19 %, 1200 банк), их можно переопределить параметрами и подтвердить с бухгалтером.
    // Формат немецкий: украинской фирме он не выгружается даже по прямой ссылке
    if (kind === "datev") {
        try {
            await requireMarket(user.id, "DE");
        } catch (e) {
            return failure(e);
        }
        return datevExport(user.id, url);
    }
    if (!["csv", "json", "yml"].includes(format)) return badRequest("format must be csv, json or yml");

    let columns: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (kind === "products") {
        const list = await prisma.product.findMany({ where: { org: user.id }, orderBy: { name: "asc" } });
        columns = ["name", "sku", "barcode", "type", "unit", "purchasePrice", "salePrice", "taxRate", "stockQty", "reorderLevel", "image"];
        rows = list.map((p) => [p.name, p.sku ?? "", p.barcode ?? "", p.type ?? "", p.unit ?? "", p.purchasePrice ?? 0, p.salePrice ?? 0, p.taxRate ?? "", p.stockQty ?? 0, p.reorderLevel ?? 0, p.image ?? ""]);
        if (format === "yml") return ymlProducts(user.id, url.origin);
    } else if (kind === "contacts") {
        const list = await prisma.contact.findMany({ where: { owner: user.id }, orderBy: { name: "asc" } });
        columns = ["name", "email", "phone", "position", "company", "website", "notes"];
        rows = list.map((c) => [c.name, c.email ?? "", c.phone ?? "", c.position ?? "", c.company ?? "", c.website ?? "", c.notes ?? ""]);
    } else if (kind === "companies") {
        const list = await prisma.company.findMany({ where: { owner: user.id }, orderBy: { name: "asc" } });
        columns = ["name", "code", "status", "address", "email", "registrationDate", "authorisedPerson", "businessType"];
        rows = list.map((c) => [c.name, c.code ?? "", c.status ?? "", c.address ?? "", c.email ?? "", c.registrationDate ?? "", c.authorisedPerson ?? "", c.businessType ?? ""]);
    } else if (kind === "invoices") {
        const list = await prisma.invoice.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 2000 });
        columns = ["number", "kind", "status", "customerName", "issueDate", "dueDate", "net", "tax", "gross", "currency", "paidAmount"];
        rows = list.map((i) => {
            const t = computeTotals(i.items as never, { exempt: !!i.smallBusinessNote });
            return [i.number, i.kind, i.status, i.customerName, i.issueDate ?? "", i.dueDate ?? "", t.net, t.tax, t.gross, i.currency, i.paidAmount ?? 0];
        });
    } else if (kind === "orders") {
        const list = await prisma.order.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 2000 });
        columns = ["number", "status", "customerName", "deliveryNoteNumber", "actNumber", "waybill", "ukrposhta", "net", "gross", "currency", "createdAt"];
        rows = list.map((o) => {
            const t = computeTotals(o.items as never);
            return [o.number, o.status, o.customerName, o.deliveryNoteNumber ?? "", o.actNumber ?? "", (o.waybill as any)?.number ?? "", (o.ukrposhta as any)?.barcode ?? "", t.net, t.gross, o.currency, o.createdAt?.toISOString?.() ?? ""];
        });
    } else if (kind === "quotes") {
        const list = await prisma.quote.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 2000 });
        columns = ["number", "status", "customerName", "issueDate", "validUntil", "net", "gross", "currency"];
        rows = list.map((q) => {
            const t = computeTotals(q.items as never);
            return [q.number, q.status, q.customerName, q.issueDate ?? "", q.validUntil ?? "", t.net, t.gross, q.currency];
        });
    } else {
        const list = await prisma.expense.findMany({ where: { org: user.id }, orderBy: { date: "desc" }, take: 2000 });
        columns = ["date", "vendor", "category", "amount", "taxRate", "currency", "notes"];
        rows = list.map((e) => [e.date, e.vendor, e.category ?? "", e.amount, e.taxRate ?? 0, e.currency, e.notes ?? ""]);
    }

    if (format === "json") {
        return new Response(JSON.stringify(rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))), null, 2), {
            headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}.json"`, "Cache-Control": "no-store" },
        });
    }
    return new Response(toCsv(columns, rows), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}.csv"`, "Cache-Control": "no-store" },
    });
}

// YML для маркетплейсов: название, цена, валюта, категория; остальное площадки берут из шаблона
async function ymlProducts(org: string, origin: string) {
    // Публичный адрес сайта: APP_URL или адрес запроса — маркетплейсам нужен рабочий адрес магазина
    const base = process.env.APP_URL?.replace(/\/+$/, "") || origin;
    const list = await prisma.product.findMany({ where: { org, type: "good", archived: false }, orderBy: { name: "asc" } });
    const offers = list
        .map(
            (p) => `    <offer id="${xmlEsc(p.sku || p.id)}" available="${(p.stockQty ?? 0) > 0 ? "true" : "false"}">
      <name>${xmlEsc(p.name)}</name>
      <price>${Number(p.salePrice ?? 0).toFixed(2)}</price>
      <currencyId>UAH</currencyId>
      <categoryId>1</categoryId>
      <quantity_in_stock>${Math.max(0, Math.round(p.stockQty ?? 0))}</quantity_in_stock>
${p.image ? `      <picture>${xmlEsc(p.image)}</picture>\n` : ""}    </offer>`
        )
        .join("\n");
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${new Date().toISOString().slice(0, 10)}">
  <shop>
    <name>${xmlEsc(origin)}</name>
    <url>${xmlEsc(base)}</url>
    <currencies><currency id="UAH" rate="1"/></currencies>
    <categories><category id="1">Каталог</category></categories>
    <offers>
${offers}
    </offers>
  </shop>
</yml_catalog>
`;
    return new Response(body, {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="products.yml"`, "Cache-Control": "no-store" },
    });
}

// DATEV-Buchungsstapel (EXTF 700, Format 21): 14 обязательных колонок + строка заголовка.
// Формат помечен [проверить]: перед загрузкой в DATEV его подтверждает бухгалтер — особенно
// счета SKR03/04, которые по умолчанию 8400 (выручка 19 %) и 1200 (банк).
async function datevExport(org: string, url: URL) {
    const year = url.searchParams.get("year") ?? String(new Date().getFullYear());
    const revenueAccount = url.searchParams.get("revenueAccount") ?? "8400";
    const bankAccount = url.searchParams.get("bankAccount") ?? "1200";
    const invoices = await prisma.invoice.findMany({
        where: { org, kind: "invoice", status: "paid", paidAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) } },
        orderBy: { paidAt: "asc" },
        select: { number: true, customerName: true, paidAt: true, paidAmount: true, currency: true, items: true },
    });
    const header = [
        "EXTF", "700", "21", "Buchungsstapel", "13",
        new Date().toISOString().slice(0, 19).replace(/[-:T]/g, ""),
        "", "", "", "", "", "", "", "", "1", // Herkunft/Exportiert von… (Vorgaben)
        "FIRMSPACE", "1", "20260101", `${year}1231`, "", "", "", "", "", "", "", "0",
    ];
    const columns = ["Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext"];
    const rows: Array<Array<string | number>> = [];
    for (const inv of invoices) {
        const items = (inv.items ?? []) as Array<{ qty?: number; unitPrice?: number; taxRate?: number }>;
        const gross = items.reduce((sum, it) => {
            const net = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
            return sum + net * (1 + (Number(it.taxRate) || 0) / 100);
        }, 0);
        const amount = Math.round((Number(inv.paidAmount) || gross) * 100) / 100;
        const paid = inv.paidAt ? new Date(inv.paidAt) : new Date();
        const ddmm = `${String(paid.getDate()).padStart(2, "0")}${String(paid.getMonth() + 1).padStart(2, "0")}`;
        // Банк — дебет (S), выручка — кредит (H): кассовый метод, как в книге доходов
        rows.push([amount, "S", inv.currency ?? "", "", "", "", bankAccount, revenueAccount, "", ddmm, String(inv.number ?? "").slice(0, 12), "", "", `${inv.number} ${inv.customerName}`.slice(0, 60)]);
    }
    // Самая частая ставка — 19 % даёт BU-ключ 3; в упрощённой выгрузке оставляем его пустым
    const csv = [header.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(";"), columns.map((c) => `"${c}"`).join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\r\n") + "\r\n";
    return new Response(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="EXTF_Buchungsstapel_${year}.csv"`,
            "Cache-Control": "no-store",
        },
    });
}
