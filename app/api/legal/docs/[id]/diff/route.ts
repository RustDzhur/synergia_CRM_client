import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { diffLines } from "@/lib/legal/diff";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET ?a=1&b=2 — сравнение двух версий документа построчно
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const a = Number(url.searchParams.get("a")), b = Number(url.searchParams.get("b"));
    if (!Number.isInteger(a) || !Number.isInteger(b)) return badRequest("a and b must be version numbers");
    const rows = await prisma.legalDocVersion.findMany({ where: { org: user.id, doc: params.id, n: { in: [a, b] } } });
    const va = rows.find((r) => r.n === a), vb = rows.find((r) => r.n === b);
    if (!va || !vb) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ a, b, lines: diffLines(va.body, vb.body) });
}
