import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { pickStrings } from "@/lib/activities";
import { TASK_TEXT_FIELDS } from "@/lib/crmFields";
import Task from "@/models/Task";
import User from "@/models/User";

// GET /api/tasks — все задачи текущего пользователя (ближайшие сроки первыми)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const tasks = await Task.find({ owner: user.id }).sort({ deadline: 1, createdAt: -1 });
    return NextResponse.json(tasks);
}

// POST /api/tasks — создать задачу
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const fields = pickStrings(await req.json(), TASK_TEXT_FIELDS, 500);
    if (!fields.title) return NextResponse.json({ message: "Title is required" }, { status: 400 });

    await connectDB();
    const author = await User.findById(user.id);
    const task = await Task.create({
        ...fields,
        owner: user.id,
        createdBy: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        responsible: fields.responsible || (author ? author.firstname : ""),
    });
    return NextResponse.json(task, { status: 201 });
}
