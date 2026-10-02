import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { renderDocumentPdf, type DocKind, type PdfDocumentData } from "@/lib/finance/pdf";
import { pdfLocale, toPdfSettings } from "@/lib/finance/document";
import { applyTemplate, templateAllowsRate, activeTemplate } from "@/lib/finance/documents/store";
import { financeSettings } from "@/lib/finance/settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Предпросмотр бланка на тестовых данных: тот же рендерер, что и у настоящих документов, поэтому
// «предпросмотр совпадает с PDF» — не пожелание, а свойство: и кнопка скачивания, и это окно
// зовут один и тот же код (ТЗ §7).

const KINDS: DocKind[] = ["invoice", "credit_note", "quote", "order", "contract", "delivery_note", "act", "packing_list"];

const SAMPLE_ITEMS = [
    { description: "Консультаційні послуги", qty: 2, unitPrice: 1500, taxRate: 20 },
    { description: "Ліцензія на програмне забезпечення", qty: 1, unitPrice: 1000, taxRate: 7 },
];

// Упаковочный лист показывает свои колонки — в предпросмотре у строк есть УКТ ЗЕД, вес и страна
const PACKING_ITEMS = [
    { description: "Консультаційні послуги", qty: 2, unitPrice: 0, taxRate: 0, hsCode: "8523 49 00 00", unitWeightKg: 0.5, originCountry: "UA" },
    { description: "Ліцензія на програмне забезпечення", qty: 1, unitPrice: 0, taxRate: 0, hsCode: "4911 99 00 00", unitWeightKg: 2, originCountry: "UA" },
];

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") as DocKind | null;
    if (!kind || !KINDS.includes(kind)) return badRequest("kind must be one of: " + KINDS.join(", "));
    const locale = pdfLocale(url.searchParams.get("locale"));
    const id = url.searchParams.get("id");
    const tpl = id && validId(id) ? await prisma.documentTemplate.findFirst({ where: { id, org: user.id } }) : await activeTemplate(user.id, kind);

    const settings = await financeSettings(user.id);
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + (Number(settings.paymentTermsDays) || 14) * 86400000).toISOString().slice(0, 10);
    const currency = (tpl?.currency || settings.currency || (String(settings.country) === "UA" ? "UAH" : "EUR")).toUpperCase();

    const common = {
        number: `${tpl?.prefix || "PREVIEW"}-${new Date().getFullYear()}-1`,
        customer: { name: "ТОВ «Тестовий клієнт»", address: "02002, м. Київ, вул. Тестова, 1", taxId: "ЄДРПОУ 87654321" },
        items: SAMPLE_ITEMS,
        currency,
        issueDate: today,
        notes: "",
        contractNumber: "12",
        template: settings.template,
    };
    const data =
        kind === "quote"
            ? { ...common, kind, validUntil: due }
            : kind === "contract"
              ? { ...common, kind, items: [], value: 120000, startDate: today, endDate: due }
              : kind === "delivery_note"
                ? { ...common, kind, supplyDate: today, orderNumber: `ЗМ-${new Date().getFullYear()}-1` }
                : kind === "packing_list"
                  ? { ...common, kind, items: PACKING_ITEMS, supplyDate: today, orderNumber: `ЗМ-${new Date().getFullYear()}-1` }
                  : kind === "act"
                    ? { ...common, kind, orderNumber: `ЗМ-${new Date().getFullYear()}-1` }
                    : { ...common, kind, dueDate: due, smallBusinessNote: false };

    const buf = await renderDocumentPdf(
        {
            ...(data as PdfDocumentData),
            uahRate: templateAllowsRate(tpl) && currency !== "UAH" ? { rate: 48.5, base: 48.0, margin: 1, at: today } : null,
        },
        applyTemplate(toPdfSettings(settings), tpl, locale),
        locale
    );
    if (!buf?.length) return notFound();
    return new Response(new Uint8Array(buf), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="preview-${kind}.pdf"`,
            "Cache-Control": "no-store",
        },
    });
}
