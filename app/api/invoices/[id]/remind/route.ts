import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { sendDunning } from "@/lib/finance/dunning";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// POST /api/invoices/:id/remind — отправить напоминание об оплате: поднять ступень манаведения,
// начислить сбор за неё и отдать событие automation (правило фирмы шлёт клиенту письмо).
// Изменение данных — только владелец/администратор (модуль inventory проверяется в requireUser).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const author = await User.findById(user.userId).select("firstname lastname");
    const name = author ? `${author.firstname} ${author.lastname}`.trim() : "";

    const result = await sendDunning(user.id, params.id, name);
    if (!result.ok) return badRequest(result.message);
    return NextResponse.json({ ok: true, level: result.level, fee: result.fee });
}
