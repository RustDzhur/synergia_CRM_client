import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings, defaultCurrency } from "@/lib/finance/settings";
import { firmRate } from "@/lib/finance/rates";
import { cleanItems } from "@/lib/finance/totals";
import { applyTaxPolicy, taxExempt } from "@/lib/finance/tax";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { isTemplate } from "@/lib/finance/pdf";
import { ownedContact, ownedCompany, ownedDeal, contactForCustomer, dealForCustomer } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import { numberPrefix } from "@/lib/finance/documents/store";

export const dynamic = "force-dynamic";

// GET /api/invoices?status=&kind= — список счетов, самые новые первыми
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const filter: Record<string, unknown> = { org: user.id };
    const status = url.searchParams.get("status"); if (status) filter.status = status;
    const kind = url.searchParams.get("kind"); if (kind) filter.kind = kind;
    const list = await prisma.invoice.findMany({ where: filter as any, orderBy: { createdAt: "desc" }, take: 300 });
    return NextResponse.json(list.map(toInvoiceDTO));
}

// POST /api/invoices — счёт напрямую (не через заказ), например разовая услуга без отдельного Order
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const customerName = typeof b?.customerName === "string" ? b.customerName.trim().slice(0, 200) : "";
    if (!customerName) return badRequest("customerName is required");
    const rawItems = cleanItems(b.items);
    if (!rawItems.length) return badRequest("At least one line item is required");
    const [settings, author, contact, company, deal] = await Promise.all([
        financeSettings(user.id), prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } }),
        ownedContact(b.contact, user.id), ownedCompany(b.company, user.id), ownedDeal(b.deal, user.id),
    ]);
    // ставку определяет фирма, а не браузер: освобождённая — 0 % во всех строках, иначе страна по умолчанию
    const items = applyTaxPolicy(rawItems, settings);
    const number = await nextNumber(user.id, await numberPrefix(user.id, "invoice", settings.invoicePrefix || "RE"));
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);
    const currency = typeof b.currency === "string" && b.currency.trim() ? b.currency.trim().slice(0, 6).toUpperCase() : await defaultCurrency(user.id);
    // Снимок курса: для гривневого счёта он не нужен, для валютного — берём у НБУ с наценкой фирмы
    const rate = currency === "UAH" ? { base: 0, margin: 0, value: 0, at: "" } : await firmRate(user.id, currency).then((r) => (r ? { base: r.base, margin: r.margin, value: r.rate, at: r.at } : { base: 0, margin: 0, value: 0, at: "" })).catch(() => ({ base: 0, margin: 0, value: 0, at: "" }));
    // Клиент текстом без карточки: имя точь-в-точь как у контакта — привязываем; нового клиента —
    // заводим карточку (владелец: «документы должны вестись вместе с карточкой клиента по CRM»)
    const linkedContact = contact || (await contactForCustomer(user.id, { contact: b.contact, company: b.company, customerName, email: b.customerEmail }));
    const invoice = await prisma.invoice.create({
        data: {
            org: user.id, number, kind: "invoice", customerName, items: items as any,
            customerAddress: typeof b.customerAddress === "string" ? b.customerAddress.trim().slice(0, 500) : "",
            customerTaxId: typeof b.customerTaxId === "string" ? b.customerTaxId.trim().slice(0, 60) : "",
            contact: linkedContact ?? undefined, company: company ?? undefined, deal: (deal || (await dealForCustomer(user.id, linkedContact, company, customerName))) ?? undefined,
            currency,
            // Курс НБУ фиксируется на дате документа: валютный счёт печатает сумму в ₴ по этому снимку,
            // а не по курсу того дня, когда документ открыли заново (ТЗ §8.2)
            rate: rate as any,
            smallBusinessNote: taxExempt(settings),
            issueDate: typeof b.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.issueDate) ? b.issueDate : today,
            dueDate: typeof b.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) ? b.dueDate : due,
            // Дата/период оказания услуг (§14 Abs. 4 Nr. 6 UStG) — необязательные, но если пришли, то только как дата
            supplyDate: typeof b.supplyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.supplyDate) ? b.supplyDate : "",
            supplyPeriodFrom: typeof b.supplyPeriodFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.supplyPeriodFrom) ? b.supplyPeriodFrom : "",
            supplyPeriodTo: typeof b.supplyPeriodTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.supplyPeriodTo) ? b.supplyPeriodTo : "",
            notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
            // ВЭД (ТЗ §12): условие поставки и номер митной декларації — для экспортных счетов
            incoterms: typeof b.incoterms === "string" ? b.incoterms.trim().toUpperCase().slice(0, 10) : "",
            customsDeclaration: typeof b.customsDeclaration === "string" ? b.customsDeclaration.trim().slice(0, 60) : "",
            template: isTemplate(b.template) ? b.template : "",
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    return NextResponse.json(toInvoiceDTO(invoice), { status: 201 });
}
