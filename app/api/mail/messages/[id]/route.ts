import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { toMailDTO } from "@/lib/mail";
import MailMessage from "@/models/MailMessage";

export const dynamic = "force-dynamic";

// GET /api/mail/messages/:id — письмо целиком; открытое письмо становится прочитанным
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    await connectDB();
    const mail = await MailMessage.findOneAndUpdate({ _id: params.id, owner: user.id, deleted: false }, { $set: { read: true } }, { returnDocument: "after" });
    if (!mail) return notFound();
    return NextResponse.json(toMailDTO(mail, true));
}
