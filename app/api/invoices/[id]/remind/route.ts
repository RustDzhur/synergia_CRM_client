import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { sendDunning } from "@/lib/finance/dunning";
import { prisma } from "@/lib/prisma";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";

// POST /api/invoices/:id/remind — отправить напоминание об оплате: поднять ступень манаведения,
// начислить сбор за неё, отдать событие automation и отправить клиенту письмо с PDF счёта из ящика фирмы.
// Изменение данных — только владелец/администратор (модуль inventory проверяется в requireUser).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await requireMarket(user.id, "DE");
    const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
    const name = author ? `${author.firstname} ${author.lastname}`.trim() : "";

    const b = (await req.json().catch(() => null)) as { locale?: unknown } | null;
    const result = await sendDunning(user.id, params.id, name, typeof b?.locale === "string" ? b.locale : undefined);
    if (!result.ok) return badRequest(result.message);
    return NextResponse.json({ ok: true, level: result.level, fee: result.fee, mail: result.mail, to: result.to });
}
