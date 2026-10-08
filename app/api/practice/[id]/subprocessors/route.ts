import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { memberOf } from "@/lib/practice/service";
import { practiceTerms } from "@/lib/practice/terms";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — журнал субподрядчиков платформы и коммерческие условия практики; только участникам практики
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!(await memberOf(params.id, user.userId))) return NextResponse.json({ message: "Practice not found" }, { status: 404 });
    return NextResponse.json({ subprocessors: await prisma.subprocessor.findMany({ orderBy: { addedAt: "asc" } }), terms: await practiceTerms() });
}
