import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { REVIEW_KINDS, reviewQueue, type ReviewKind } from "@/lib/review/service";

export const dynamic = "force-dynamic";

// GET ?kind=invoices|expenses&status= — документы на проверке и с замечаниями (по умолчанию needs_review + needs_fix)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? "invoices";
    if (!(REVIEW_KINDS as readonly string[]).includes(kind)) return badRequest("Unknown kind");
    return NextResponse.json({ items: await reviewQueue(user.id, kind as ReviewKind, url.searchParams.get("status") ?? undefined) });
}
