import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { toMailDTO } from "@/lib/mail";
import MailMessage from "@/models/MailMessage";

export const dynamic = "force-dynamic";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/mail/messages?account=<id>&q=<поиск> — письма ящика (последние 300, без текста; текст — в /messages/:id)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const account = url.searchParams.get("account");
    if (!account || !validId(account)) return badRequest("account is required");
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);

    await connectDB();
    const filter: Record<string, unknown> = { owner: user.id, account, deleted: false };
    if (q) {
        const re = new RegExp(escapeRe(q), "i");
        filter.$or = [{ subject: re }, { from: re }, { to: re }, { body: re }];
    }
    const list = await MailMessage.find(filter).select("-body").sort({ at: -1 }).limit(300);
    return NextResponse.json(list.map((m) => toMailDTO(m, false)));
}

// PATCH /api/mail/messages — { ids, patch: { starred?, snoozed?, read? } }
export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const ids: unknown[] = Array.isArray(body?.ids) ? body.ids.slice(0, 300) : [];
    if (!ids.length || !ids.every((i) => typeof i === "string" && validId(i))) return badRequest("ids are required");
    const set: Record<string, boolean> = {};
    for (const k of ["starred", "snoozed", "read"]) if (typeof body?.patch?.[k] === "boolean") set[k] = body.patch[k];
    if (!Object.keys(set).length) return badRequest("Nothing to update");
    await connectDB();
    await MailMessage.updateMany({ _id: { $in: ids }, owner: user.id }, { $set: set });
    return NextResponse.json({ ok: true });
}

// DELETE /api/mail/messages — { ids }: убрать письма из CRM (на почтовом сервере они остаются)
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const ids: unknown[] = Array.isArray(body?.ids) ? body.ids.slice(0, 300) : [];
    if (!ids.length || !ids.every((i) => typeof i === "string" && validId(i))) return badRequest("ids are required");
    await connectDB();
    await MailMessage.updateMany({ _id: { $in: ids }, owner: user.id }, { $set: { deleted: true } });
    return NextResponse.json({ ok: true });
}
