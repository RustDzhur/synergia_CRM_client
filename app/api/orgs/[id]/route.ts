import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

// PATCH /api/orgs/:id — { name }: переименовать текущую фирму (владелец или администратор)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id) || params.id !== user.id) return notFound(); // менять можно только ту фирму, в которой работаете сейчас
    if (user.role !== "owner" && user.role !== "admin") return NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.replace(/[\p{Cc}<>]/gu, "").trim().slice(0, 80) : "";
    if (!name) return badRequest("Firm name is required");
    await connectDB();
    const org = await Organization.findByIdAndUpdate(params.id, { name }, { new: true });
    return org ? NextResponse.json({ id: String(org._id), name: org.name }) : notFound();
}
