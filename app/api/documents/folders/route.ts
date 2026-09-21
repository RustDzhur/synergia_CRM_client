import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { cleanName, ownedFolder, toFolderDTO } from "@/lib/documents";
import DocFolder from "@/models/DocFolder";

export const dynamic = "force-dynamic";

const MAX_FOLDERS = 500;

// POST /api/documents/folders — { name, parent? }: новая папка. В Google Drive одноимённая папка создаётся при первом документе в ней.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const name = cleanName(body?.name, 80);
    if (!name) return badRequest("Folder name is required");
    try {
        await connectDB();
        const parent = await ownedFolder(user.id, body?.parent);
        if (parent === undefined) return badRequest("Folder not found");
        if ((await DocFolder.countDocuments({ owner: user.id })) >= MAX_FOLDERS) return badRequest("Too many folders");
        const parentId = parent ? parent._id : null;
        if (await DocFolder.exists({ owner: user.id, parent: parentId, name })) return NextResponse.json({ message: "A folder with this name already exists" }, { status: 409 });
        const folder = await DocFolder.create({ owner: user.id, name, parent: parentId });
        return NextResponse.json(toFolderDTO(folder), { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
