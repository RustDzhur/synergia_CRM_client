import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { fetchMailBody, toMailDTO } from "@/lib/mail";
import Integration from "@/models/Integration";
import MailMessage from "@/models/MailMessage";

export const dynamic = "force-dynamic";

// GET /api/mail/messages/:id — письмо целиком; открытое письмо становится прочитанным
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const mail = await MailMessage.findOneAndUpdate({ _id: params.id, owner: user.id, deleted: false }, { $set: { read: true } }, { returnDocument: "after" });
    if (!mail) return notFound();

    // Разметку письма забираем у провайдера один раз: письма, загруженные до того, как CRM начала
    // её хранить, остались текстом, а кликабельные ссылки и картинки нужны и в них. Ошибку глотаем —
    // письмо всё равно покажем (текстом), а попытка повторится при следующем открытии.
    if (!mail.html) {
        try {
            const account = await Integration.findOne({ _id: mail.account, owner: user.id, type: "mail" });
            if (account) {
                const body = await fetchMailBody(account, String(mail.externalId));
                if (body.html || body.text) {
                    mail.html = body.html.slice(0, 300_000);
                    if (body.text) mail.body = body.text.slice(0, 20000);
                    await mail.save();
                }
            }
        } catch { /* показываем то, что есть */ }
    }
    return NextResponse.json(toMailDTO(mail, true));
}
