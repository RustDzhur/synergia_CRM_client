import { connectDB } from "@/lib/mongodb";
import { rateLimited } from "@/lib/rateLimit";
import { findByToken } from "@/lib/integrations";
import { contactValue, corsJson, corsPreflight, validVisitor } from "@/lib/channels/webchat";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import Contact from "@/models/Contact";
import Conversation from "@/models/Conversation";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// POST { visitor, value, name? } — посетитель оставил почту или телефон. Контакт заводится в CRM и
// привязывается к переписке: заявка не теряется, даже если человека не было на месте.
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (rateLimited(`webchat-contact:${params.token}:${ip}`, 10, 60_000)) return corsJson({ message: "Too many requests" }, 429);

    const body = await req.json().catch(() => null);
    const value = contactValue(body?.value);
    if (!validVisitor(body?.visitor) || !value) return corsJson({ message: "Bad request" }, 400);

    await connectDB();
    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const conversation = await Conversation.findOne({ integration: integration._id, externalId: body.visitor });
    if (!conversation) return corsJson({ message: "Not found" }, 404);

    const owner = String(integration.owner);
    const email = value.includes("@") ? value.toLowerCase() : "";
    const phone = email ? "" : value;
    const name = String(conversation.name || body?.name || email || phone).slice(0, 60);

    // контакт ищем по почте или телефону: заводить второй на того же человека не нужно
    let contact = await Contact.findOne({ owner, ...(email ? { email } : { phone }) });
    if (!contact) contact = await Contact.create({ owner, name, ...(email ? { email } : { phone }), source: "webchat" });
    if (!conversation.contact) {
        conversation.contact = contact._id;
        await conversation.save();
    }
    // запись в ленте контакта: откуда он взялся
    await Contact.updateOne(
        { _id: contact._id, owner },
        { $push: { activities: { type: "note", text: `Контакт оставлен в чате на сайте${conversation.lastText ? `: ${conversation.lastText}` : ""}` } } }
    ).catch(() => undefined);

    void notifyTeamTelegram(
        [
            "📇 Посетитель оставил контакт в чате на сайте",
            `Имя: ${name}`,
            `${email ? "Почта" : "Телефон"}: ${email || phone}`,
            conversation.lastText ? `Последний вопрос: ${conversation.lastText}` : "",
        ]
            .filter(Boolean)
            .join("\n")
    );
    return corsJson({ ok: true });
}
