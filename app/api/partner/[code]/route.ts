import { NextResponse } from "next/server";
import { notFound } from "@/lib/api";
import { countVisit, landing } from "@/lib/partner/service";

export const dynamic = "force-dynamic";

// GET /api/partner/:code — публичные данные страницы банка-партнёра: только название банка и его коннектор
export async function GET(_req: Request, { params }: { params: { code: string } }) {
    const l = await landing(params.code);
    return l ? NextResponse.json(l) : notFound();
}

// POST — засчитать визит по ссылке банка (без данных о посетителе)
export async function POST(_req: Request, { params }: { params: { code: string } }) {
    if (!(await landing(params.code))) return notFound();
    await countVisit(params.code);
    return NextResponse.json({ ok: true });
}
