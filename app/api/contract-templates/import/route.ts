import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { DocxError, docxToHtml, docxToText } from "@/lib/docxText";
import { sanitizeHtml, textToHtml } from "@/lib/finance/contractHtml";

export const dynamic = "force-dynamic";

// POST /api/contract-templates/import — multipart: file (.docx, .txt, .md) → { text, html }. Юрист присылает договор файлом;
// текст попадает в редактор, где в нужные места ставятся поля-меточки. Файл не сохраняется.
const MAX = 3 * 1024 * 1024;

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob) || !file.size) return badRequest("file is required");
    if (file.size > MAX) return badRequest("The file is too large (3 MB maximum)");
    const name = String((file as File).name ?? "").toLowerCase();
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
        if (name.endsWith(".docx") || (bytes[0] === 0x50 && bytes[1] === 0x4b)) return NextResponse.json({ text: docxToText(bytes).slice(0, 60000), html: sanitizeHtml(docxToHtml(bytes)) });
        if (/\.(txt|md|text)$/.test(name) || file.type.startsWith("text/")) { const text = bytes.toString("utf8").replace(/^\uFEFF/, "").slice(0, 60000); return NextResponse.json({ text, html: textToHtml(text) }); }
    } catch (e) {
        if (e instanceof DocxError) return badRequest("Could not read the document — save it as .docx or .txt");
        throw e;
    }
    return badRequest("Supported formats: .docx, .txt");
}
