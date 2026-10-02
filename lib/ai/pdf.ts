// Текст из PDF (документы в файловом хранилище, PDF-чеки расходов).
// unpdf (обёртка над современным pdf.js) — работает в серверless-окружении Next без воркера и читает в том числе
// PDF, которые раньше валились на "bad XRef entry" (pdf-parse 1.1.1 с pdf.js 1.10 не разбирал, например, файлы,
// сгенерированные нашим же pdfkit).
import { extractText, getDocumentProxy } from "unpdf";
import { ProviderError } from "@/lib/http";

const MAX_TEXT = 12000; // символов текста, которые уходят модели (страница договора умещается многократно)
const MAX_BYTES = 15 * 1024 * 1024; // держим файл в памяти целиком — ограничиваем на всякий случай

// Отсканированные PDF без текстового слоя вернут пустую строку — на это указываем пользователю отдельно (см. receipt.ts).
export async function extractPdfText(bytes: Buffer): Promise<{ text: string; pages: number; truncated: boolean }> {
    if (bytes.length > MAX_BYTES) throw new ProviderError("This PDF is too large to read (over 15 MB)");
    let raw = "";
    let pages = 0;
    try {
        const pdf = await getDocumentProxy(new Uint8Array(bytes));
        const result = await extractText(pdf, { mergePages: true });
        raw = result.text ?? "";
        pages = result.totalPages ?? 0;
    } catch {
        throw new ProviderError("Could not read this PDF (it may be damaged or password-protected)");
    }
    const text = raw.replace(/\n{3,}/g, "\n\n").trim();
    return { text: text.slice(0, MAX_TEXT), pages, truncated: text.length > MAX_TEXT };
}
