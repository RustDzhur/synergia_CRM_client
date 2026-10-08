import { NextResponse } from "next/server";
import { findByToken } from "@/lib/integrations";
import { handleClick } from "@/lib/uzpay/click";
import { withPeriodLock } from "@/lib/finance/periodLock";

export const dynamic = "force-dynamic";

// SHOP API Click: один адрес /api/webhooks/click/<маркер фирмы> вписывается в кабинет Click и как Prepare URL, и как Complete URL —
// действие различается полем action (0 — Prepare, 1 — Complete). Тело — form-urlencoded; подпись sign_string проверяется всегда.
async function handlePOST(req: Request, { params }: { params: { token: string } }) {
    const doc = await findByToken("click", params.token);
    if (!doc) return NextResponse.json({ error: -8, error_note: "Error in request from click" }, { status: 404 });
    return NextResponse.json(await handleClick(doc as never, await req.text()));
}

export const POST = withPeriodLock(handlePOST);
