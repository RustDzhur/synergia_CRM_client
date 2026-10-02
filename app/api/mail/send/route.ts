import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { sendFromAccount, toMailDTO } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

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
        const account = await prisma.integration.findFirst({ where: { id: b.accountId, owner: user.id, type: "mail" } });
        if (!account) return notFound();

        const draftId = typeof b.draftId === "string" && validId(b.draftId) ? b.draftId : null;
        if (isDraft) {
            const fields = { from: String((account.config as any)?.email ?? ""), to: recipients.join(", "), subject, body: text, at: new Date() };
            let draft = null;
            if (draftId) {
                const existing = await prisma.mailMessage.findFirst({ where: { id: draftId, owner: user.id, folder: "draft" } });
                if (existing) draft = await prisma.mailMessage.update({ where: { id: existing.id }, data: fields });
            } else {
                draft = await prisma.mailMessage.create({ data: { ...fields, owner: user.id, account: account.id, externalId: `draft:${randomToken(8)}`, folder: "draft", read: true } });
            }
            return NextResponse.json(draft ? toMailDTO(draft, false) : null, { status: 201 });
        }

        const sent = await sendFromAccount(account, { to: recipients.join(", "), subject: subject || "(no subject)", text });
        if (draftId) await prisma.mailMessage.updateMany({ where: { id: draftId, owner: user.id, folder: "draft" }, data: { deleted: true } });
        return NextResponse.json(sent ? toMailDTO(sent, false) : null, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
