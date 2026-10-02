import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { getObject } from "@/lib/storage";
import { aiConfigured } from "@/lib/ai/provider";
import { dailyLimit, takeQuota, log as logAi } from "@/lib/ai/run";
import { SUPPORTED_RECEIPT_MIME, extractReceipt } from "@/lib/ai/receipt";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/expenses/extract — { documentId }: OCR/AI reads an already-uploaded receipt (via /api/documents/upload)
// and returns suggested expense fields for the user to review in the New Expense form — it never creates the Expense
// itself. Counts against the same daily AI quota as Firmspace AI chat (plan-based, lib/ai/run.ts): it is the same
// underlying model call, so a firm's OCR scans and chat questions share one limit rather than doubling the AI cost.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!aiConfigured()) return NextResponse.json({ message: "AI is not set up on this site yet", code: "not_configured" }, { status: 503 });
    const b = await req.json().catch(() => null);
    if (!validId(b?.documentId)) return badRequest("documentId is required");
    try {
        const doc = await prisma.docItem.findFirst({ where: { id: b.documentId, owner: user.id, kind: "file" } });
        if (!doc || !doc.storagePath) return notFound();
        if (!SUPPORTED_RECEIPT_MIME.has(doc.mime)) return badRequest("Upload a photo (JPEG/PNG) or a PDF of the receipt");

        const limit = await dailyLimit(user.id);
        if (!(await takeQuota(user.id, limit))) return NextResponse.json({ message: "The daily AI limit of your plan is used up. It resets tomorrow.", code: "limit", remaining: 0 }, { status: 429 });

        const res = await getObject(doc.storagePath);
        if (!res) return notFound();
        const bytes = Buffer.from(await res.arrayBuffer());
        const fields = await extractReceipt(bytes, doc.mime);
        await logAi({ org: user.id, userId: user.userId }, "read", "extract_receipt", { documentId: b.documentId }, JSON.stringify(fields));
        return NextResponse.json({ documentId: b.documentId, ...fields });
    } catch (e) {
        return failure(e);
    }
}
