import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import Contract from "@/models/Contract";
import { toContractDTO } from "@/lib/finance/dto";

// POST /api/contracts/:id/cancel — draft или active → cancelled (сорвалась сделка, клиент отказался).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const c = await Contract.findOne({ _id: params.id, org: user.id });
    if (!c) return notFound();
    if (c.status !== "draft" && c.status !== "active") return badRequest("This contract cannot be cancelled");
    c.status = "cancelled";
    await c.save();
    await logAudit({ org: user.id, userId: user.userId, action: "contract.cancelled", entityType: "contract", entityId: String(c._id), summary: `Contract ${c.number} cancelled` });
    return NextResponse.json(toContractDTO(c));
}
