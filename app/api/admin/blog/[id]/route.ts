import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requirePlatformAdmin } from "@/lib/admin";
import { notFound, validId } from "@/lib/api";
import BlogPost from "@/models/BlogPost";

const toAdminDTO = (p: any) => ({
    id: String(p._id), slug: p.slug, image: p.image,
    title: p.title, excerpt: p.excerpt, body: p.body,
    published: p.published, publishedAt: p.publishedAt.toISOString().slice(0, 10),
});
const tx = (v: any) => ({ en: String(v?.en ?? "").slice(0, 4000), de: String(v?.de ?? "").slice(0, 4000), ua: String(v?.ua ?? "").slice(0, 4000) });

// PATCH /api/admin/blog/:id — { slug?, image?, title?, excerpt?, body?, published? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const post = await BlogPost.findById(params.id);
    if (!post) return notFound();

    if (typeof b.slug === "string" && b.slug.trim()) post.slug = b.slug.trim().toLowerCase().slice(0, 80);
    if (typeof b.image === "string" && b.image.trim()) post.image = b.image.trim().slice(0, 300);
    if (b.title) post.title = tx(b.title) as any;
    if (b.excerpt) post.excerpt = tx(b.excerpt) as any;
    if (Array.isArray(b.body)) post.body = b.body.slice(0, 40).map(tx) as any;
    if (typeof b.published === "boolean") post.published = b.published;
    await post.save();
    return NextResponse.json(toAdminDTO(post));
}

// DELETE /api/admin/blog/:id
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    await connectDB();
    const r = await BlogPost.deleteOne({ _id: params.id });
    return r.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
