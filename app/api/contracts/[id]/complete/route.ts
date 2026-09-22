import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import Contract from "@/models/Contract";
import { toContractDTO } from "@/lib/finance/dto";

// POST /api/contracts/:id/complete — работы по действующему договору завершены (сдача-приёмка сделана вне системы или
// через отдельный документ в Files) — active → completed. Без своего события автоматизации: обычно к этому моменту всё
// уже закрыто через order_status/invoice_paid.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const c = await Contract.findOne({ _id: params.id, org: user.id });
    if (!c) return notFound();
    if (c.status !== "active") return badRequest("Only an active contract can be completed");
    c.status = "completed";
    await c.save();
    return NextResponse.json(toContractDTO(c));
}
