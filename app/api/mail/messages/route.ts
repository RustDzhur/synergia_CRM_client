import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { toMailDTO, trashMailMessages } from "@/lib/mail";
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

// DELETE /api/mail/messages — { ids }: убрать письма из CRM и переместить их в корзину на почтовом сервере.
// Сначала провайдер, потом локальная пометка: если ящик отказал, письмо остаётся в CRM и возвращается
// понятная ошибка. Ответ при частичном успехе — 502 со списками deleted/failed (успешные уже помечены).
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const ids: unknown[] = Array.isArray(body?.ids) ? body.ids.slice(0, 300) : [];
    if (!ids.length || !ids.every((i) => typeof i === "string" && validId(i))) return badRequest("ids are required");

    const found = await prisma.mailMessage.findMany({
        where: { id: { in: ids as string[] }, owner: user.id, deleted: false },
        select: { id: true, account: true, externalId: true, folder: true },
    });
    if (!found.length) return NextResponse.json({ ok: true, deleted: [], failed: [] });

    const accounts = await prisma.integration.findMany({
        where: { id: { in: Array.from(new Set(found.map((m) => m.account))) }, owner: user.id, type: "mail" },
    });
    const deleted: string[] = [];
    const failed: { id: string; message: string }[] = [];

    for (const account of accounts) {
        const items = found.filter((m) => m.account === account.id);
        let refusals: { id: string; message: string }[] = [];
        try {
            refusals = await trashMailMessages(account, items);
        } catch (e) {
            // Ящик не отвечает / токен отозван: ни одно письмо этого ящика локально не трогаем
            const message = e instanceof Error ? e.message : "The mail server did not confirm the deletion";
            refusals = items.map((m) => ({ id: m.id, message }));
        }
        const refused = new Set(refusals.map((f) => f.id));
        const ok = items.filter((m) => !refused.has(m.id)).map((m) => m.id);
        if (ok.length) {
            await prisma.mailMessage.updateMany({ where: { id: { in: ok }, owner: user.id }, data: { deleted: true } });
            deleted.push(...ok);
        }
        failed.push(...refusals);
    }

    // Запись есть, а ящика уже нет (отключён параллельно): провайдеру удалять нечего — убираем локально
    const orphan = found.filter((m) => !accounts.some((a) => a.id === m.account)).map((m) => m.id);
    if (orphan.length) {
        await prisma.mailMessage.updateMany({ where: { id: { in: orphan }, owner: user.id }, data: { deleted: true } });
        deleted.push(...orphan);
    }

    if (failed.length) {
        const first = failed[0].message;
        const message =
            failed.length === 1
                ? `Could not delete the e-mail on the mail server: ${first}. It is still in the CRM.`
                : `Could not delete ${failed.length} e-mails on the mail server: ${first}. They are still in the CRM.`;
        return NextResponse.json({ ok: false, message, deleted, failed }, { status: 502 });
    }
    return NextResponse.json({ ok: true, deleted, failed: [] });
}
