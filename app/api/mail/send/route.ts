import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { sendFromAccount, toMailDTO } from "@/lib/mail";
import Integration from "@/models/Integration";
import MailMessage from "@/models/MailMessage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ADDRESS = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// POST /api/mail/send — { accountId, to, subject, body, draft?: true, draftId? }
// draft: true — сохранить черновик (только в CRM), иначе отправить письмо через ящик
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b.accountId !== "string" || !validId(b.accountId)) return badRequest("accountId is required");
    const to = typeof b.to === "string" ? b.to.trim() : "";
    const subject = typeof b.subject === "string" ? b.subject.trim().replace(/[\r\n]+/g, " ").slice(0, 300) : "";
    const text = typeof b.body === "string" ? b.body.slice(0, 20000) : "";
    const isDraft = b.draft === true;

    const recipients = to.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean);
    if (!isDraft && (recipients.length === 0 || recipients.length > 20 || !recipients.every((a: string) => ADDRESS.test(a)))) return badRequest("Enter a valid recipient address");

    try {
        await connectDB();
        const account = await Integration.findOne({ _id: b.accountId, owner: user.id, type: "mail" });
        if (!account) return notFound();

        const draftId = typeof b.draftId === "string" && validId(b.draftId) ? b.draftId : null;
        if (isDraft) {
            const fields = { from: account.config.email, to: recipients.join(", "), subject, body: text, at: new Date() };
            const draft = draftId
                ? await MailMessage.findOneAndUpdate({ _id: draftId, owner: user.id, folder: "draft" }, { $set: fields }, { returnDocument: "after" })
                : await MailMessage.create({ ...fields, owner: user.id, account: account._id, externalId: `draft:${randomToken(8)}`, folder: "draft", read: true });
            return NextResponse.json(draft ? toMailDTO(draft, false) : null, { status: 201 });
        }

        const sent = await sendFromAccount(account, { to: recipients.join(", "), subject: subject || "(no subject)", text });
        if (draftId) await MailMessage.updateOne({ _id: draftId, owner: user.id, folder: "draft" }, { $set: { deleted: true } });
        return NextResponse.json(sent ? toMailDTO(sent, false) : null, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
