import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const t = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");

export async function GET(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json({ subprocessors: await prisma.subprocessor.findMany({ orderBy: { addedAt: "asc" } }) });
}

// POST { name, purpose, country?, data? } — добавить субподрядчика в журнал
export async function POST(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = await req.json().catch(() => null);
    const name = t(b?.name, 100), purpose = t(b?.purpose, 300);
    if (!name || !purpose) return badRequest("name and purpose are required");
    return NextResponse.json(await prisma.subprocessor.create({ data: { name, purpose, country: t(b?.country, 60), data: t(b?.data, 300) } }), { status: 201 });
}
