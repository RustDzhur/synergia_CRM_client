import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const toAdminDTO = (p: any) => ({
    id: p.id, slug: p.slug, image: p.image,
    title: p.title, excerpt: p.excerpt, body: p.body,
    published: p.published, publishedAt: p.publishedAt.toISOString().slice(0, 10),
});

const slugify = (s: string) =>
    s.toLowerCase().trim().normalize("NFKD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "post";

async function uniqueSlug(base: string) {
    let slug = base, n = 2;
    while (await prisma.blogPost.findUnique({ where: { slug } })) slug = `${base}-${n++}`;
    return slug;
}

// GET /api/admin/blog — все статьи (включая черновики), только для владельца платформы (ADMIN_EMAILS)
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const posts = await prisma.blogPost.findMany({ orderBy: { publishedAt: "desc" } });
    return NextResponse.json(posts.map(toAdminDTO));
}

// POST /api/admin/blog — { slug?, image?, title, excerpt, body[], published? }: slug генерируется из title.en, если не задан
export async function POST(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = await req.json().catch(() => null);
    const titleEn = typeof b?.title?.en === "string" ? b.title.en.trim() : "";
    if (!titleEn) return badRequest("English title is required");
    const base = slugify(typeof b.slug === "string" && b.slug.trim() ? b.slug : titleEn);
    const slug = await uniqueSlug(base);
    const tx = (v: any) => ({ en: String(v?.en ?? "").slice(0, 4000), de: String(v?.de ?? "").slice(0, 4000), ua: String(v?.ua ?? "").slice(0, 4000), uz: String(v?.uz ?? "").slice(0, 4000) });
    const post = await prisma.blogPost.create({
        data: {
            slug,
            image: typeof b.image === "string" && b.image.trim() ? b.image.trim().slice(0, 300) : "/images/blog/code.jpg",
            title: tx(b.title) as any, excerpt: tx(b.excerpt) as any,
            body: Array.isArray(b.body) ? b.body.slice(0, 40).map(tx) as any : [],
            published: b.published !== false,
        },
    });
    return NextResponse.json(toAdminDTO(post), { status: 201 });
}
