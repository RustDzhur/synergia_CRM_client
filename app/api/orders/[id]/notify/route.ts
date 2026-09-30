import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { sendToConversation } from "@/lib/channels";
import { mailAccount } from "@/lib/finance/send";
import { sendFromAccount, mailboxCanSend } from "@/lib/mail";
import Contact from "@/models/Contact";
import Conversation from "@/models/Conversation";
import Integration from "@/models/Integration";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/orders/:id/notify — отправить клиенту номер ТТН или штрихкода Укрпошты.
//
// Куда уходит: сперва в живую переписку с контактом (Telegram, Viber, WhatsApp, Messenger — там бот
// может отвечать только тому, кто уже писал), иначе письмом с ящика фирмы. Если ни того, ни другого
// нет — честный отказ с причиной: менеджер сам напишет клиенту или позвонит.

const MESSAGING = ["telegram", "viber", "whatsapp", "messenger"];
const digits = (v: string) => v.replace(/\D/g, "");

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        const order = await Order.findOne({ _id: params.id, org: user.id });
        if (!order) return notFound();

        const waybill = String(order.waybill?.number ?? "");
        const ukr = String(order.ukrposhta?.barcode ?? "");
        if (!waybill && !ukr) return badRequest("У замовлення ще немає номера відправлення");

        const text =
            typeof body.text === "string" && body.text.trim()
                ? body.text.trim().slice(0, 600)
                : waybill
                  ? `Ваше замовлення ${order.number} відправлено «Новою Поштою». Номер ТТН: ${waybill}.`
                  : `Ваше замовлення ${order.number} відправлено «Укрпоштою». Номер відправлення: ${ukr}.`;

        // 1) Живая переписка с контактом: сначала по контакту, потом по совпадению телефона
        if (order.contact) {
            const contact = await Contact.findOne({ _id: order.contact, owner: user.id }).select("phone");
            const conversations = await Conversation.find({ owner: user.id, channel: { $in: MESSAGING } }).select("channel contact externalId");
            const phone = digits(String(contact?.phone ?? ""));
            const conversation =
                conversations.find((c) => String(c.contact ?? "") === String(order.contact)) ??
                (phone ? conversations.find((c) => digits(String(c.externalId ?? "")) === phone) : undefined);
            if (conversation) {
                const integration = await Integration.findOne({ owner: user.id, type: conversation.channel, status: "connected" });
                if (integration) {
                    await sendToConversation(integration, conversation, text);
                    return NextResponse.json({ ok: true, via: conversation.channel });
                }
            }
        }

        // 2) Письмо с ящика фирмы — когда человек оставил почту, а переписки в мессенджере нет
        const contact = order.contact ? await Contact.findOne({ _id: order.contact, owner: user.id }).select("email") : null;
        const email = String(contact?.email ?? "");
        if (email) {
            const account = await mailAccount(user.id);
            if (account && mailboxCanSend(account)) {
                await sendFromAccount(account, { to: email, subject: `${order.number}: номер відправлення`, text });
                return NextResponse.json({ ok: true, via: "email", to: email });
            }
            return badRequest("Пошту фірми не підключено (або ящик лише для читання) — надішліть номер клієнту вручну");
        }
        return badRequest("У контакта немає ні переписки в месенджері, ні пошти — надішліть номер клієнту вручну");
    } catch (e) {
        return failure(e);
    }
}
