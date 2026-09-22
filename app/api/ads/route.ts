import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { adsAvailable, adsPlanOk, findAds, toConnectionDTO } from "@/lib/ads";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

// GET /api/ads — какие рекламные платформы настроены на сервере, разрешает ли их тариф фирмы, и какие подключены
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    return NextResponse.json({ available: adsAvailable(), planOk: await adsPlanOk(user.id), connections: (await findAds(user.id)).map(toConnectionDTO) });
}

// PATCH /api/ads — { id, accountId }: выбрать рекламный аккаунт из найденных
export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || !validId(String(b.id))) return badRequest("Invalid request");
    await connectDB();
    const doc = await Integration.findOne({ _id: b.id, owner: user.id, type: "ads" });
    if (!doc) return notFound();
    if (!(doc.config.accounts ?? []).some((a: { id: string }) => a.id === String(b.accountId))) return badRequest("Unknown ad account");
    doc.set("config", { ...doc.config, accountId: String(b.accountId) });
    doc.markModified("config");
    await doc.save();
    return NextResponse.json(toConnectionDTO(doc));
}

// DELETE /api/ads?id= — отключить платформу (токены удаляются)
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!validId(id)) return badRequest("Invalid request");
    await connectDB();
    const res = await Integration.deleteOne({ _id: id, owner: user.id, type: "ads" });
    return res.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
