import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { syncAccount, toMailAccountDTO } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/mail/accounts/:id/sync — забрать новые письма с почтового сервера
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        const doc = await prisma.integration.findFirst({ where: { id: params.id, owner: user.id, type: "mail" } });
        if (!doc) return notFound();
        const { added, leads } = await syncAccount(doc);
        // статус и ошибку синхронизация уже записала — отдаём актуальную запись
        const fresh = await prisma.integration.findUnique({ where: { id: doc.id } });
        return NextResponse.json({ added, leads, account: toMailAccountDTO(fresh ?? doc) });
    } catch (e) {
        return failure(e);
    }
}
