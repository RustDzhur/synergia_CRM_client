import { NextResponse } from "next/server";
import { notFound } from "@/lib/api";
import { toBlogDTO } from "@/lib/blog";
import { prisma } from "@/lib/prisma";

// GET /api/blog/:slug — одна опубликованная статья, публично
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
    const post = await prisma.blogPost.findUnique({ where: { slug: params.slug } });
    return post && post.published ? NextResponse.json(toBlogDTO(post)) : notFound();
}
