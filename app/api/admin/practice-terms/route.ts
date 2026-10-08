import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/api";
import { practiceTerms, setPracticeTerms } from "@/lib/practice/terms";

export const dynamic = "force-dynamic";

// GET/PUT — коммерческие значения «Практики» (бесплатных клиентов, цена подписки, скидка клиенту, включение ограничения); без деплоя
export async function GET(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json(await practiceTerms());
}
export async function PUT(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    return NextResponse.json(await setPracticeTerms(b));
}
