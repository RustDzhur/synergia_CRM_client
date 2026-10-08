import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { accessLogForOrg } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// GET ?link=&limit= — журнал доступа специалистов к данным фирмы (владельцу и администратору)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    try {
        const entries = await accessLogForOrg(user.id, user.role, { link: url.searchParams.get("link") ?? undefined, limit: Number(url.searchParams.get("limit")) || 100 });
        return NextResponse.json({ entries });
    } catch (e) {
        return practiceFailure(e);
    }
}
