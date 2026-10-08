import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { notFound, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const toAdminDTO = (p: any) => ({
    id: p.id, slug: p.slug, image: p.image,
    title: p.title, excerpt: p.excerpt, body: p.body,
    published: p.published, publishedAt: p.publishedAt.toISOString().slice(0, 10),
});
const tx = (v: any) => ({ en: String(v?.en ?? "").slice(0, 4000), de: String(v?.de ?? "").slice(0, 4000), ua: String(v?.ua ?? "").slice(0, 4000), uz: String(v?.uz ?? "").slice(0, 4000) });

// PATCH /api/admin/blog/:id — { slug?, image?, title?, excerpt?, body?, published? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const post = await prisma.blogPost.findUnique({ where: { id: params.id } });
    if (!post) return notFound();

    const data: Record<string, any> = {};
    if (typeof b.slug === "string" && b.slug.trim()) data.slug = b.slug.trim().toLowerCase().slice(0, 80);
    if (typeof b.image === "string" && b.image.trim()) data.image = b.image.trim().slice(0, 300);
    if (b.title) data.title = tx(b.title);
    if (b.excerpt) data.excerpt = tx(b.excerpt);
    if (Array.isArray(b.body)) data.body = b.body.slice(0, 40).map(tx);
    if (typeof b.published === "boolean") data.published = b.published;
    const updated = await prisma.blogPost.update({ where: { id: params.id }, data });
    return NextResponse.json(toAdminDTO(updated));
}

// DELETE /api/admin/blog/:id
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    const r = await prisma.blogPost.deleteMany({ where: { id: params.id } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
