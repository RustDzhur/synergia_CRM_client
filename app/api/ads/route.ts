import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { adsAvailable, adsPlanOk, findAds, toConnectionDTO } from "@/lib/ads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/ads — какие рекламные платформы настроены на сервере, разрешает ли их тариф фирмы, и какие подключены
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ available: adsAvailable(), planOk: await adsPlanOk(user.id), connections: (await findAds(user.id)).map(toConnectionDTO) });
}

// PATCH /api/ads — { id, accountId }: выбрать рекламный аккаунт из найденных
export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || !validId(String(b.id))) return badRequest("Invalid request");
    const doc = await prisma.integration.findFirst({ where: { id: String(b.id), owner: user.id, type: "ads" } });
    if (!doc) return notFound();
    const config = (doc.config ?? {}) as any;
    if (!(config.accounts ?? []).some((a: { id: string }) => a.id === String(b.accountId))) return badRequest("Unknown ad account");
    const updated = await prisma.integration.update({ where: { id: doc.id }, data: { config: { ...config, accountId: String(b.accountId) } as any } });
    return NextResponse.json(toConnectionDTO(updated));
}

// DELETE /api/ads?id= — отключить платформу (токены удаляются)
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!validId(id)) return badRequest("Invalid request");
    const res = await prisma.integration.deleteMany({ where: { id, owner: user.id, type: "ads" } });
    return res.count ? NextResponse.json({ ok: true }) : notFound();
}
