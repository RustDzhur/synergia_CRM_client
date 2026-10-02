import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { fetchMailBody, toMailDTO } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/mail/messages/:id — письмо целиком; открытое письмо становится прочитанным
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const found = await prisma.mailMessage.findFirst({ where: { id: params.id, owner: user.id, deleted: false } });
    if (!found) return notFound();
    let mail = await prisma.mailMessage.update({ where: { id: found.id }, data: { read: true } });

    // Разметку письма забираем у провайдера один раз: письма, загруженные до того, как CRM начала
    // её хранить, остались текстом, а кликабельные ссылки и картинки нужны и в них. Ошибку глотаем —
    // письмо всё равно покажем (текстом), а попытка повторится при следующем открытии.
    if (!mail.html) {
        try {
            const account = await prisma.integration.findFirst({ where: { id: String(mail.account), owner: user.id, type: "mail" } });
            if (account) {
                const body = await fetchMailBody(account, String(mail.externalId));
                if (body.html || body.text) {
                    mail = await prisma.mailMessage.update({
                        where: { id: mail.id },
                        data: { html: body.html.slice(0, 300_000), ...(body.text ? { body: body.text.slice(0, 20000) } : {}) },
                    });
                }
            }
        } catch { /* показываем то, что есть */ }
    }
    return NextResponse.json(toMailDTO(mail, true));
}
