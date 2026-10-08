import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { createPractice, myPractices, PRACTICE_TERMS_VERSION } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// GET /api/practice — практики, в которых состоит пользователь (и версия текста договора, который надо принять)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ practices: await myPractices(user.userId), termsVersion: PRACTICE_TERMS_VERSION });
}

// POST /api/practice — { name, kind: accountant|lawyer, market?, acceptTerms: true }: открыть практику (создатель — партнёр)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await createPractice(user.userId, b), { status: 201 });
    } catch (e) {
        return practiceFailure(e);
    }
}
