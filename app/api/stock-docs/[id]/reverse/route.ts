import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { reverseStockDoc } from "@/lib/finance/stockDocs";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/stock-docs/:id/reverse — сторно документа. Ошибку в складе исправляют не правкой, а
// обратным документом: исходный остаётся в журнале, движения гасятся, обе записи видно рядом.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const reversal = await reverseStockDoc(user.id, params.id, author ? `${author.firstname} ${author.lastname}`.trim() : "");
        await logAudit({ org: user.id, userId: user.userId, action: "stock.reverse", entityType: "stock_doc", entityId: params.id, summary: `Stock document ${params.id} reversed by ${reversal.number}`, meta: { reversal: String(reversal.id) } });
        return NextResponse.json({ id: String(reversal.id), number: reversal.number }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
