import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import Contract from "@/models/Contract";
import { toContractDTO } from "../route";

// завершённый/отменённый договор уже мог породить события/заказы — не редактируется, только для истории
const LOCKED = ["completed", "cancelled"];

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const c = await Contract.findOne({ _id: params.id, org: user.id });
    return c ? NextResponse.json(toContractDTO(c)) : notFound();
}

// PATCH /api/contracts/:id — { customerName?, value?, startDate?, endDate?, notes?, file? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const contract = await Contract.findOne({ _id: params.id, org: user.id });
    if (!contract) return notFound();
    if (LOCKED.includes(contract.status)) return badRequest("This contract is completed or cancelled and can no longer be edited");

    if (typeof b.customerName === "string" && b.customerName.trim()) contract.customerName = b.customerName.trim().slice(0, 200);
    if (b.value !== undefined) contract.value = Math.max(0, Number(b.value) || 0);
    if (typeof b.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.startDate)) contract.startDate = b.startDate;
    if (typeof b.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.endDate)) contract.endDate = b.endDate;
    if (typeof b.notes === "string") contract.notes = b.notes.trim().slice(0, 2000);
    if (typeof b.file === "string" && b.file) contract.file = b.file as any;
    await contract.save();
    return NextResponse.json(toContractDTO(contract));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const r = await Contract.deleteOne({ _id: params.id, org: user.id, status: "draft" });
    return r.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
