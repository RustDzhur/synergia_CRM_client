import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { toMailDTO } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/mail/messages?account=<id>&q=<поиск> — письма ящика (последние 300, без текста; текст — в /messages/:id)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const account = url.searchParams.get("account");
    if (!account || !validId(account)) return badRequest("account is required");
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);

    // поиск был регулярным выражением по четырём полям — теперь contains + insensitive (экранировать не нужно)
    const filter: Record<string, unknown> = { owner: user.id, account, deleted: false };
    if (q) {
        filter.OR = [
            { subject: { contains: q, mode: "insensitive" } },
            { from: { contains: q, mode: "insensitive" } },
            { to: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
        ];
    }
    const list = await prisma.mailMessage.findMany({
        where: filter as any,
        orderBy: { at: "desc" },
        take: 300,
        select: { id: true, account: true, folder: true, from: true, to: true, subject: true, at: true, starred: true, snoozed: true, read: true },
    });
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
    await prisma.mailMessage.updateMany({ where: { id: { in: ids as string[] }, owner: user.id }, data: set });
    return NextResponse.json({ ok: true });
}

// DELETE /api/mail/messages — { ids }: убрать письма из CRM (на почтовом сервере они остаются)
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const ids: unknown[] = Array.isArray(body?.ids) ? body.ids.slice(0, 300) : [];
    if (!ids.length || !ids.every((i) => typeof i === "string" && validId(i))) return badRequest("ids are required");
    await prisma.mailMessage.updateMany({ where: { id: { in: ids as string[] }, owner: user.id }, data: { deleted: true } });
    return NextResponse.json({ ok: true });
}
