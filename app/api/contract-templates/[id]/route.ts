import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { cleanBody } from "@/lib/finance/contractHtml";

const toDTO = (t: any) => ({
    id: t.id,
    name: t.name,
    body: t.body ?? "",
    fields: Array.isArray(t.fields) ? t.fields : [],
    active: !!t.active,
});

const cleanField = (f: any) => {
    const key = String(f?.key ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 60);
    const label = String(f?.label ?? "").trim().slice(0, 100);
    if (!key || !label) return null;
    const type = ["text", "date", "number", "money"].includes(f?.type) ? f.type : "text";
    const source = f?.source === "contact" ? "contact" : "manual";
    return { key, label, type, source };
};

// PATCH /api/contract-templates/:id — { name?, body?, fields?, active? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const t = await prisma.contractTemplate.findFirst({ where: { id: params.id, org: user.id } });
    if (!t) return notFound();
    const b = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof b.name === "string") data.name = b.name.trim().slice(0, 120);
    if (typeof b.body === "string") data.body = cleanBody(b.body);
    if (Array.isArray(b.fields)) data.fields = b.fields.map(cleanField).filter(Boolean).slice(0, 200);
    if (typeof b.active === "boolean") data.active = b.active;
    const updated = await prisma.contractTemplate.update({ where: { id: params.id }, data });
    return NextResponse.json(toDTO(updated));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const r = await prisma.contractTemplate.deleteMany({ where: { id: params.id, org: user.id } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
