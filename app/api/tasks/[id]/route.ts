import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { pickStrings } from "@/lib/activities";
import { TASK_TEXT_FIELDS } from "@/lib/crmFields";
import Task from "@/models/Task";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = pickStrings(body, TASK_TEXT_FIELDS, 500);
    if ("title" in data && !data.title) return NextResponse.json({ message: "Title is required" }, { status: 400 });
    for (const flag of ["completed", "pinned", "muted"] as const) {
        if (typeof body[flag] === "boolean") data[flag] = body[flag];
    }

    await connectDB();
    const task = await Task.findOneAndUpdate({ _id: params.id, owner: user.id }, { $set: data }, { new: true });
    if (!task) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(task);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const task = await Task.findOneAndDelete({ _id: params.id, owner: user.id });
    if (!task) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
