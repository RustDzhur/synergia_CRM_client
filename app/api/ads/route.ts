import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { adsAvailable, adsMissingGoogle, adsPlanOk, findAds, toConnectionDTO } from "@/lib/ads";
import { prisma } from "@/lib/prisma";
import { ensurePlatformEnv } from "@/lib/platformEnv";
import { appOrigin } from "@/lib/appUrl";
import { adsRedirectUri } from "@/lib/mail/oauth";

export const dynamic = "force-dynamic";

// GET /api/ads — какие рекламные платформы настроены на сервере, разрешает ли их тариф фирмы, и какие подключены
export async function GET(req: Request) {
    await ensurePlatformEnv();
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ available: adsAvailable(), missing: { google: adsMissingGoogle() }, redirectUri: adsRedirectUri(appOrigin(req)), planOk: await adsPlanOk(user.id), connections: (await findAds(user.id)).map(toConnectionDTO) });
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
    const patch: Record<string, unknown> = {};
    // accountId обязателен при выборе аккаунта; loginCustomerId можно сохранить отдельно
    if (b.accountId !== undefined) {
        if (!(config.accounts ?? []).some((a: { id: string }) => a.id === String(b.accountId))) return badRequest("Unknown ad account");
        patch.accountId = String(b.accountId);
    }
    if (b.loginCustomerId !== undefined) {
        // Google принимает ID менеджерского аккаунта без дефисов; пустая строка — сброс
        const digits = String(b.loginCustomerId).replace(/\D/g, "");
        if (digits && !/^\d{6,12}$/.test(digits)) return badRequest("Manager account id must be 6–12 digits");
        patch.loginCustomerId = digits;
    }
    if (Object.keys(patch).length === 0) return badRequest("Nothing to update");
    const updated = await prisma.integration.update({ where: { id: doc.id }, data: { config: { ...config, ...patch } as any } });
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
