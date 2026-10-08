import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { syncAll } from "@/lib/banks/provider";
import { withPeriodLock } from "@/lib/finance/periodLock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/bank/sync — обновить выписки всех привязанных банковских счетов фирмы; ошибка одного банка не мешает остальным
async function handlePost(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        return NextResponse.json({ accounts: await syncAll(user.id) });
    } catch (e) {
        return failure(e);
    }
}
export const POST = withPeriodLock(handlePost);
