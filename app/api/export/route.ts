import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { toCsv } from "@/lib/import/csv";
import { computeTotals } from "@/lib/finance/totals";
import Product from "@/models/Product";
import Contact from "@/models/Contact";
import Company from "@/models/Company";
import Invoice from "@/models/Invoice";
import Order from "@/models/Order";
import Quote from "@/models/Quote";
import Expense from "@/models/Expense";

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
    // (8400 выручка 19 %, 1200 банк), их можно переопределить параметрами и подтвердить с бухгалтером
    if (kind === "datev") {
        return datevExport(user.id, url);
    }
    if (!["csv", "json", "yml"].includes(format)) return badRequest("format must be csv, json or yml");

    await connectDB();
    let columns: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (kind === "products") {
        const list = await Product.find({ org: user.id }).sort({ name: 1 });
        columns = ["name", "sku", "type", "unit", "purchasePrice", "salePrice", "taxRate", "stockQty", "reorderLevel", "image"];
        rows = list.map((p) => [p.name, p.sku ?? "", p.type ?? "", p.unit ?? "", p.purchasePrice ?? 0, p.salePrice ?? 0, p.taxRate ?? "", p.stockQty ?? 0, p.reorderLevel ?? 0, p.image ?? ""]);
        if (format === "yml") return ymlProducts(user.id, url.origin);
    } else if (kind === "contacts") {
        const list = await Contact.find({ owner: user.id }).sort({ name: 1 });
        columns = ["name", "email", "phone", "position", "company", "website", "notes"];
        rows = list.map((c) => [c.name, c.email ?? "", c.phone ?? "", c.position ?? "", c.company ?? "", c.website ?? "", c.notes ?? ""]);
    } else if (kind === "companies") {
        const list = await Company.find({ owner: user.id }).sort({ name: 1 });
        columns = ["name", "code", "status", "address", "email", "registrationDate", "authorisedPerson", "businessType"];
        rows = list.map((c) => [c.name, c.code ?? "", c.status ?? "", c.address ?? "", c.email ?? "", c.registrationDate ?? "", c.authorisedPerson ?? "", c.businessType ?? ""]);
    } else if (kind === "invoices") {
        const list = await Invoice.find({ org: user.id }).sort({ createdAt: -1 }).limit(2000);
        columns = ["number", "kind", "status", "customerName", "issueDate", "dueDate", "net", "tax", "gross", "currency", "paidAmount"];
        rows = list.map((i) => {
            const t = computeTotals(i.items as never, { exempt: !!i.smallBusinessNote });
            return [i.number, i.kind, i.status, i.customerName, i.issueDate ?? "", i.dueDate ?? "", t.net, t.tax, t.gross, i.currency, i.paidAmount ?? 0];
        });
    } else if (kind === "orders") {
        const list = await Order.find({ org: user.id }).sort({ createdAt: -1 }).limit(2000);
        columns = ["number", "status", "customerName", "deliveryNoteNumber", "actNumber", "waybill", "ukrposhta", "net", "gross", "currency", "createdAt"];
        rows = list.map((o) => {
            const t = computeTotals(o.items as never);
            return [o.number, o.status, o.customerName, o.deliveryNoteNumber ?? "", o.actNumber ?? "", o.waybill?.number ?? "", o.ukrposhta?.barcode ?? "", t.net, t.gross, o.currency, o.createdAt?.toISOString?.() ?? ""];
        });
    } else if (kind === "quotes") {
        const list = await Quote.find({ org: user.id }).sort({ createdAt: -1 }).limit(2000);
        columns = ["number", "status", "customerName", "issueDate", "validUntil", "net", "gross", "currency"];
        rows = list.map((q) => {
            const t = computeTotals(q.items as never);
            return [q.number, q.status, q.customerName, q.issueDate ?? "", q.validUntil ?? "", t.net, t.gross, q.currency];
        });
    } else {
        const list = await Expense.find({ org: user.id }).sort({ date: -1 }).limit(2000);
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
    const list = await Product.find({ org, type: "good", archived: { $ne: true } }).sort({ name: 1 });
    const offers = list
        .map(
            (p) => `    <offer id="${xmlEsc(p.sku || String(p._id))}" available="${(p.stockQty ?? 0) > 0 ? "true" : "false"}">
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
    const invoices = await Invoice.find({ org, kind: "invoice", status: "paid", paidAt: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31T23:59:59`) } }).sort({ paidAt: 1 }).select("number customerName paidAt paidAmount currency items");
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
