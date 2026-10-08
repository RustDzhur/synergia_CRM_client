import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { COMMENT_KINDS, addComment, listComments } from "@/lib/review/comments";
import { actorOf, reviewFailure } from "@/lib/review/http";

export const dynamic = "force-dynamic";
type Kind = (typeof COMMENT_KINDS)[number];
const kindOf = (v: unknown): Kind | null => ((COMMENT_KINDS as readonly string[]).includes(String(v)) ? (v as Kind) : null);

// GET ?kind=invoices|expenses|legal&id= — комментарии документа и список людей, которых можно упомянуть
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const u = new URL(req.url);
    const kind = kindOf(u.searchParams.get("kind")), id = u.searchParams.get("id") ?? "";
    if (!kind || !id) return badRequest("kind and id are required");
    try { return NextResponse.json(await listComments(user.id, kind, id)); } catch (e) { return reviewFailure(e); }
}

// POST { kind, id, text, mentions?: userId[] }
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const kind = kindOf(b?.kind);
    if (!b || !kind || typeof b.id !== "string") return badRequest("kind and id are required");
    try { return NextResponse.json(await addComment(user.id, await actorOf(user), kind, b.id, b), { status: 201 }); } catch (e) { return reviewFailure(e); }
}
