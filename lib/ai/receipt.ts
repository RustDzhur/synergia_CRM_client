import { ProviderError } from "@/lib/http";
import { extractPdfText } from "./pdf";
import { complete, completeVision } from "./provider";

const SYSTEM = `You extract structured data from a purchase receipt or invoice (photo or PDF) for a small business's expense tracker. Read only what is actually printed on the document — never invent a vendor name, amount, date or tax rate. Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{"vendor": string, "amount": number, "taxRate": number, "currency": string, "date": string, "category": string}
"amount" is the NET amount (before tax) if both net and gross are printed; if only one total is printed, use it as amount and set taxRate to the percentage shown, or 0 if none is printed. "currency" is the ISO 4217 code, e.g. "EUR". "date" is the receipt/invoice date as "YYYY-MM-DD". "category" is a short guess such as "Office supplies", "Travel", "Software", "Rent", "Materials" — leave it "" if genuinely unclear. If a field cannot be read at all, use "" for text fields and 0 for numbers.`;

export interface ExtractedReceipt { vendor: string; amount: number; taxRate: number; currency: string; date: string; category: string }

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const SUPPORTED_RECEIPT_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function parseJson(raw: string): ExtractedReceipt {
    const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    let v: Record<string, unknown>;
    try {
        v = JSON.parse(cleaned);
    } catch {
        throw new ProviderError("The AI could not read this receipt");
    }
    const str = (x: unknown) => (typeof x === "string" ? x.slice(0, 200) : "");
    const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    const date = typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : "";
    return {
        vendor: str(v.vendor),
        amount: Math.max(0, num(v.amount)),
        taxRate: Math.min(100, Math.max(0, num(v.taxRate))),
        currency: (str(v.currency).toUpperCase().slice(0, 6) || "EUR"),
        date,
        category: str(v.category).slice(0, 100),
    };
}

// Распознаёт чек/счёт (фото или PDF) и возвращает предложенные поля расхода — сама Expense не создаётся, пользователь
// проверяет и правит в форме перед сохранением (тот же принцип "AI предлагает, человек подтверждает", что и в чате).
export async function extractReceipt(bytes: Buffer, mime: string): Promise<ExtractedReceipt> {
    if (mime === "application/pdf") {
        const { text } = await extractPdfText(bytes);
        if (!text) throw new ProviderError("This PDF has no readable text — a scanned receipt needs to be a photo (JPEG/PNG), not a scanned PDF");
        const r = await complete(SYSTEM, [{ role: "user", text: `Receipt text:\n\n${text}` }], []);
        return parseJson(r.text);
    }
    if (IMAGE_MIME.has(mime)) {
        const text = await completeVision(SYSTEM, "Read this receipt image and extract the fields as instructed.", { mimeType: mime, base64: bytes.toString("base64") });
        return parseJson(text);
    }
    throw new ProviderError("Upload a photo (JPEG/PNG) or a PDF of the receipt");
}
