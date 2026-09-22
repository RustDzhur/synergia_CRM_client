// pdf-parse's own package entry (index.js) runs a debug self-test at import time when `module.parent` is falsy
// (`if (!module.parent) { fs.readFileSync('./test/data/...') }`) — under Next.js/webpack bundling `module.parent`
// is not what Node gives a normal require(), so that branch runs and crashes the whole route at import time.
// Its inner implementation file has no such guard, so we import that directly instead.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { ProviderError } from "@/lib/http";

const MAX_TEXT = 12000; // символов текста, которые уходят модели (страница договора умещается многократно)
const MAX_BYTES = 15 * 1024 * 1024; // pdf-parse держит файл в памяти целиком — ограничиваем на всякий случай

// Текст из PDF (для документов Firebase Storage). pdf-parse — старая версия 1.x с простым API: pdfParse(buffer) -> { text, numpages }.
// Отсканированные PDF без текстового слоя вернут пустую строку — на это указываем пользователю отдельно.
export async function extractPdfText(bytes: Buffer): Promise<{ text: string; pages: number; truncated: boolean }> {
    if (bytes.length > MAX_BYTES) throw new ProviderError("This PDF is too large to read (over 15 MB)");
    let data: { text: string; numpages: number };
    try {
        data = await pdfParse(bytes);
    } catch {
        throw new ProviderError("Could not read this PDF (it may be damaged or password-protected)");
    }
    const text = (data.text ?? "").replace(/\n{3,}/g, "\n\n").trim();
    return { text: text.slice(0, MAX_TEXT), pages: data.numpages ?? 0, truncated: text.length > MAX_TEXT };
}
