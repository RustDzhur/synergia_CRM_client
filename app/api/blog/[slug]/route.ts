import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { notFound } from "@/lib/api";
import { toBlogDTO } from "@/lib/blog";
import BlogPost from "@/models/BlogPost";

// GET /api/blog/:slug — одна опубликованная статья, публично
export async function GET(req: Request, { params }: { params: { slug: string } }) {
    await connectDB();
    const post = await BlogPost.findOne({ slug: params.slug, published: true });
    return post ? NextResponse.json(toBlogDTO(post)) : notFound();
}
