import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { toBlogDTO } from "@/lib/blog";
import BlogPost from "@/models/BlogPost";

export const dynamic = "force-dynamic";

// GET /api/blog — публичный список опубликованных статей для лендинга, без авторизации (сам сайт не защищён логином)
export async function GET() {
    await connectDB();
    const posts = await BlogPost.find({ published: true }).sort({ publishedAt: -1 }).limit(200);
    return NextResponse.json(posts.map(toBlogDTO));
}
