import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { getObject } from "@/lib/storage";
import { extractPdfText } from "@/lib/ai/pdf";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { financeSettings } from "@/lib/finance/settings";
import { defaultRateFor } from "@/lib/finance/tax";
import { loadExpenseCategories } from "@/lib/finance/expenseCatalogDb";
import { extractExpenseFields, type ExpenseExtractMeta } from "@/lib/finance/expenseExtract";
import { mergeAutofill } from "@/lib/finance/expenseTax";
import { toExpenseDTO } from "@/lib/finance/expenseDto";
import { withPeriodLock } from "@/lib/finance/periodLock";
import type { DatevChart } from "@/lib/finance/expenseCatalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEXT_MIME = /^(text\/|application\/(json|xml|csv|xhtml\+xml)$)/i;
const MAX_TEXT = 50_000;

const strOf = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
const numOf = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Метаданные распознавания: принимаем только известные поля и только простых типов. */
function parseMeta(value: unknown): ExpenseExtractMeta {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const m = value as Record<string, unknown>;
    const meta: ExpenseExtractMeta = {
        vendor: strOf(m.vendor, 200),
        amount: numOf(m.amount),
        netAmount: numOf(m.netAmount),
        grossAmount: numOf(m.grossAmount),
        vatAmount: numOf(m.vatAmount),
        taxRate: numOf(m.taxRate),
        currency: strOf(m.currency, 6),
        date: strOf(m.date, 10),
        paidDate: strOf(m.paidDate, 10),
        documentNumber: strOf(m.documentNumber, 80),
        vendorVatId: strOf(m.vendorVatId, 20),
        vendorIban: strOf(m.vendorIban, 40),
        category: strOf(m.category, 60),
        subcategory: strOf(m.subcategory, 60),
    };
    for (const key of Object.keys(meta) as Array<keyof ExpenseExtractMeta>) if (meta[key] === undefined) delete meta[key];
    return meta;
}

/** Текст документа из хранилища: PDF читаем unpdf, текстовые форматы — как есть, фото без OCR не берём. */
async function textFromDocument(org: string, documentId: string): Promise<string> {
    const doc = await prisma.docItem.findFirst({ where: { id: documentId, owner: org, kind: "file" } });
    if (!doc || !doc.storagePath) throw new Error("__not_found__");
    const res = await getObject(doc.storagePath);
    if (!res) throw new Error("__not_found__");
    const bytes = Buffer.from(await res.arrayBuffer());
    const isPdf = doc.mime === "application/pdf" || /\.pdf$/i.test(doc.name);
    if (isPdf) {
        const { text } = await extractPdfText(bytes);
        if (!text.trim()) throw new Error("__no_text__");
        return text;
    }
    if (TEXT_MIME.test(doc.mime) || /\.(txt|csv|json|xml|html?)$/i.test(doc.name)) {
        const raw = bytes.toString("utf8");
        return /<html|<\?xml/i.test(raw) ? raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : raw;
    }
    throw new Error("__unsupported_mime__");
}

// POST /api/expenses/:id/autofill — { documentId?, documentText?, meta?, overwrite? }
// Заполняет налоговые поля по правилам lib/finance/expenseExtract.ts и пишет их в расход.
// Ручные поля (manualFields) не перекрываются, пока клиент явно не пришлёт overwrite: true.
async function handlePOST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const expense = await prisma.expense.findFirst({ where: { id: params.id, org: user.id } });
    if (!expense) return notFound();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest("Invalid request body");

    const settings = await financeSettings(user.id);
    const chart: DatevChart = body.chart === "SKR04" || body.chart === "SKR03" ? body.chart : settings.datevChart === "SKR04" ? "SKR04" : "SKR03";
    const { entries } = await loadExpenseCategories();

    const bodyText = typeof body.documentText === "string" ? body.documentText.slice(0, MAX_TEXT) : "";
    const meta = parseMeta(body.meta);
    const metaGiven = Object.keys(meta).length > 0;
    const documentId = body.documentId && validId(String(body.documentId)) ? String(body.documentId) : "";
    let text = bodyText;
    let source: "text" | "document" | "meta" | "mixed" = bodyText ? (metaGiven ? "mixed" : "text") : "meta";

    if (!text) {
        // Без текста документа смотрим на уже прикреплённый чек; иначе остаются только метаданные
        const targetId = documentId || expense.receipt || "";
        if (targetId) {
            try {
                text = await textFromDocument(user.id, targetId);
                source = metaGiven ? "mixed" : "document";
            } catch (e) {
                const message = e instanceof Error ? e.message : "";
                if (message === "__not_found__") return notFound();
                if (message === "__no_text__") return badRequest("This PDF has no readable text — paste the document text or upload a text-based PDF");
                if (message === "__unsupported_mime__") return badRequest("Only PDF and text documents can be read without OCR — paste the text or use the receipt scanner");
                return failure(e);
            }
        }
    }
    if (!text && !metaGiven) return badRequest("Provide documentText, meta or attach a readable document");

    const extraction = extractExpenseFields({
        text,
        meta: metaGiven ? meta : undefined,
        categories: entries,
        chart,
        defaultRate: defaultRateFor(settings),
        today: new Date().toISOString().slice(0, 10),
        vendorHint: expense.vendor,
    });

    const merged = mergeAutofill(
        expense as unknown as Record<string, unknown>,
        extraction.fields,
        extraction.detected,
        { overwrite: body.overwrite === true, currentReviewStatus: expense.reviewStatus, confidence: extraction.confidence }
    );

    let updated = expense;
    if (merged.applied.length) {
        const data: Record<string, unknown> = {
            ...merged.data,
            confidence: extraction.confidence,
            reviewStatus: merged.reviewStatus,
            // Снимок автоопределения: что нашли, чем подтверждено, из какого источника
            autoFields: {
                at: new Date().toISOString(),
                source,
                documentId: documentId || expense.receipt || null,
                confidence: extraction.confidence,
                reviewStatus: merged.reviewStatus,
                fields: Object.fromEntries(extraction.detected.map((field) => [field, extraction.fields[field]])),
                evidence: extraction.evidence,
                warnings: extraction.warnings.map((w) => w.code),
            } as never,
        };
        updated = await prisma.expense.update({ where: { id: expense.id }, data: data as never });
        await logAudit({
            org: user.id, userId: user.userId, action: "expense.autofilled", entityType: "expense", entityId: expense.id,
            summary: `Expense ${expense.vendor} — ${merged.applied.length} fields autofilled (${source})`,
            meta: { applied: merged.applied, confidence: extraction.confidence, reviewStatus: merged.reviewStatus, source },
        });
    }

    return NextResponse.json({
        expenseId: expense.id,
        source,
        applied: merged.applied,
        skipped: merged.skipped,
        confidence: extraction.confidence,
        confidenceByField: extraction.confidenceByField,
        reviewStatus: merged.reviewStatus,
        evidence: extraction.evidence,
        warnings: extraction.warnings,
        fields: extraction.fields,
        category: extraction.category,
        manualFields: Array.isArray(updated.manualFields) ? updated.manualFields : [],
        expense: toExpenseDTO(updated),
    });
}

// Закрытый период: налоговые поля меняют учёт — 423, а не «Server error»
export const POST = withPeriodLock(handlePOST);
