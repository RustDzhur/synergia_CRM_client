import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { TASK_TEXT_FIELDS } from "@/lib/crmFields";
import Project from "@/models/Project";
import Task from "@/models/Task";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = pickStrings(body, TASK_TEXT_FIELDS, 500);
    if ("title" in data && !data.title) return NextResponse.json({ message: "Title is required" }, { status: 400 });
    for (const flag of ["completed", "pinned", "muted"] as const) {
        if (typeof body[flag] === "boolean") data[flag] = body[flag];
    }

    await connectDB();
    // привязку к проекту проверяем отдельно: чужой проект привязать нельзя, а пустая строка снимает привязку
    if ("project" in body) {
        const id = body.project;
        if (typeof id === "string" && id) {
            const owned = await Project.findOne({ _id: id, owner: user.id }).select("_id").catch(() => null);
            if (!owned) return NextResponse.json({ message: "Project not found" }, { status: 400 });
            data.project = owned._id;
        } else {
            data.project = undefined;
        }
    }
    const task = await Task.findOneAndUpdate({ _id: params.id, owner: user.id }, data.project === undefined && "project" in body ? { $set: data, $unset: { project: "" } } : { $set: data }, { new: true });
    if (!task) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(task);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    await connectDB();
    const task = await Task.findOneAndDelete({ _id: params.id, owner: user.id });
    if (!task) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
