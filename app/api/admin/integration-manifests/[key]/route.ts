import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest, notFound } from "@/lib/api";
import { MANIFEST_SEED } from "@/lib/integrations/manifests";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PUT /api/admin/integration-manifests/:key — { status: available|beta|planned, title?, source? }. Статус «available» для сервиса,
// который проверен на живых тестовых ключах (docs/TZ_MASTER.md §6.3), ставит администратор платформы.
export async function PUT(req: Request, { params }: { params: { key: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const seed = MANIFEST_SEED.find((m) => m.key === params.key);
    if (!seed) return notFound();
    const b = await req.json().catch(() => null);
    if (!b || !["available", "beta", "planned"].includes(b.status)) return badRequest("status must be available, beta or planned");
    if (b.status !== "planned" && !seed.connectable) return badRequest("There is no connection code for this integration yet — it stays planned");
    const prev = await prisma.integrationManifest.findUnique({ where: { key: params.key } });
    const row = await prisma.integrationManifest.upsert({
        where: { key: params.key },
        create: { key: params.key, status: b.status, title: typeof b.title === "string" ? b.title.slice(0, 80) : "", source: typeof b.source === "string" ? b.source.slice(0, 200) : "", version: 2 },
        update: { status: b.status, ...(typeof b.title === "string" ? { title: b.title.slice(0, 80) } : {}), ...(typeof b.source === "string" ? { source: b.source.slice(0, 200) } : {}), version: (prev?.version ?? 1) + 1 },
    });
    return NextResponse.json(row);
}
