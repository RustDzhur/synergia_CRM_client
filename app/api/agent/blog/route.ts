import { NextResponse } from "next/server";
import { agentAuthorized, parsePost } from "@/lib/agentBlog";
import { rateLimited } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// API блога для внешнего агента (DeepSeek Harness и т.п.), см. lib/agentBlog.ts и docs/AGENTS.md.
//   GET  /api/agent/blog            — все статьи (и черновики): slug, статус, заголовок, дата
//   GET  /api/agent/blog?slug=...   — одна статья целиком
//   POST /api/agent/blog            — { slug?, title:{en,de,ua}, excerpt:{en,de,ua}, body:[{en,de,ua},…], image?, overwrite? }
//        статья сохраняется ЧЕРНОВИКОМ; публикует её владелец (Айрис: «опубликуй статью …»). Автопубликация — только если
//        на сервере включено AGENT_BLOG_AUTOPUBLISH=1 и агент прислал publish:true.
const denied = (why: "off" | "denied") =>
    why === "off" ? NextResponse.json({ message: "Agent access is not enabled on this server (AGENT_BLOG_TOKEN is not set)" }, { status: 503 }) : NextResponse.json({ message: "Invalid token" }, { status: 401 });

export async function GET(req: Request) {
    const auth = agentAuthorized(req);
    if (auth !== "ok") return denied(auth);
    const slug = new URL(req.url).searchParams.get("slug");
    if (slug) {
        const p = await prisma.blogPost.findUnique({ where: { slug } });
        return p ? NextResponse.json({ slug: p.slug, published: p.published, publishedAt: p.publishedAt, image: p.image, title: p.title, excerpt: p.excerpt, body: p.body }) : NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    const list = await prisma.blogPost.findMany({ orderBy: { publishedAt: "desc" }, take: 300 });
    return NextResponse.json(list.map((p) => ({ slug: p.slug, published: p.published, publishedAt: p.publishedAt, title: (p.title as { en?: string } | null)?.en ?? "" })));
}

export async function POST(req: Request) {
    const auth = agentAuthorized(req);
    if (auth !== "ok") return denied(auth);
    if (rateLimited("agent-blog", 30, 3_600_000)) return NextResponse.json({ message: "Too many posts this hour" }, { status: 429 });
    const body = await req.json().catch(() => null);
    let post;
    try { post = parsePost(body); } catch (e) { return NextResponse.json({ message: e instanceof Error ? e.message : "Invalid article" }, { status: 400 }); }
    const existing = await prisma.blogPost.findUnique({ where: { slug: post.slug } });
    // уже опубликованную статью агент без явного overwrite не трогает
    if (existing?.published && !post.overwrite) return NextResponse.json({ message: `Article "${post.slug}" is already published; send overwrite:true to replace it or pick another slug` }, { status: 409 });
    const data = { title: post.title as never, excerpt: post.excerpt as never, body: post.body as never, ...(post.image ? { image: post.image } : {}) };
    const saved = existing
        ? await prisma.blogPost.update({ where: { slug: post.slug }, data: { ...data, ...(post.publish ? { published: true } : {}) } })
        : await prisma.blogPost.create({ data: { slug: post.slug, ...data, published: post.publish } });
    return NextResponse.json({ ok: true, slug: saved.slug, published: saved.published, url: `/blog/${saved.slug}`, note: saved.published ? "Published." : "Saved as a draft — the owner publishes it (Ayris: «опубликуй статью»)." }, { status: existing ? 200 : 201 });
}
