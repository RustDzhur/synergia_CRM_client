import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized } from "@/lib/api";
import { getJob } from "@/lib/ai/jobs";

export const dynamic = "force-dynamic";

// GET /api/ai/jobs/:id?after=N — ход очереди задач Айрис: готовые результаты начиная с N-го (страница опрашивает раз в пару секунд)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const job = getJob(params.id);
    if (!job || job.userId !== user.userId || job.org !== user.id) return notFound();
    const after = Math.max(0, Number(new URL(req.url).searchParams.get("after")) || 0);
    return NextResponse.json({ status: job.status, total: job.total, next: job.results.length, results: job.results.slice(after), summary: job.status === "done" ? job.summary : "" });
}
