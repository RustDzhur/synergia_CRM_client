import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { TASK_TEXT_FIELDS } from "@/lib/crmFields";
import { emit } from "@/lib/automation/emit";
import { postTask } from "@/lib/feed";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";

// Проект задачи: возвращаем только свой — чужой id из запроса игнорируем
async function ownedProject(id: unknown, org: string) {
    if (typeof id !== "string" || !id) return null;
    return Project.findOne({ _id: id, owner: org }).select("_id").catch(() => null);
}

// GET /api/tasks — все задачи текущего пользователя (ближайшие сроки первыми)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    await connectDB();
    const tasks = await Task.find({ owner: user.id }).sort({ deadline: 1, createdAt: -1 });
    return NextResponse.json(tasks);
}

// POST /api/tasks — создать задачу
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json().catch(() => ({}));
    const fields = pickStrings(body, TASK_TEXT_FIELDS, 500);
    if (!fields.title) return NextResponse.json({ message: "Title is required" }, { status: 400 });

    await connectDB();
    const author = await User.findById(user.userId);
    // проект проверяем на принадлежность фирме: чужой id привязывать нельзя
    const project = await ownedProject(body?.project, user.id);
    const task = await Task.create({
        ...fields,
        owner: user.id,
        project: project?._id,
        createdBy: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        responsible: fields.responsible || (author ? author.firstname : ""),
    });
    await postTask(user.id, user.userId, task); // карточка в ленте фирмы + уведомление коллегам
    await emit(user.id, { type: "task_created", data: { id: String(task._id), title: task.title, responsible: task.responsible ?? "" } });
    return NextResponse.json(task, { status: 201 });
}
