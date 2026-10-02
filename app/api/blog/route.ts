import { NextResponse } from "next/server";
import { toBlogDTO } from "@/lib/blog";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/blog — публичный список опубликованных статей для лендинга, без авторизации (сам сайт не защищён логином)
export async function GET() {
    const posts = await prisma.blogPost.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" }, take: 200 });
    return NextResponse.json(posts.map(toBlogDTO));
}
