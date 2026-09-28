import { connectDB } from "@/lib/mongodb";
import { findByToken } from "@/lib/integrations";
import { corsJson, corsPreflight } from "@/lib/channels/webchat";
import { CHATBOT_FAQ } from "@/app/content/chatbotFaq";
import { tx } from "@/app/content/i18n";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// GET ?lang= — настройки виджета: заголовок, приветствие, цвет, быстрые вопросы бота и ссылки на другие
// каналы фирмы. Виджет один: в нём и готовые ответы бота, и переписка с человеком, и переход в мессенджер,
// если посетителю удобнее продолжить там.
export async function GET(req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const { title, greeting, color } = integration.config;
    const lang = new URL(req.url).searchParams.get("lang") ?? "en";

    // быстрые вопросы — те же готовые тексты, по которым отвечает бот (app/content/chatbotFaq.ts)
    const quick = CHATBOT_FAQ.slice(0, 4).map((f) => ({ id: f.id, text: tx(f.q, lang) }));

    // Ссылки на другие каналы фирмы: показываем только подключённые — вести посетителя в никуда нельзя
    const owner = integration.owner;
    const [telegram, viber, whatsapp] = await Promise.all([
        Integration.findOne({ owner, type: "telegram", status: "connected" }).lean().catch(() => null),
        Integration.findOne({ owner, type: "viber", status: "connected" }).lean().catch(() => null),
        Integration.findOne({ owner, type: "whatsapp", status: "connected" }).lean().catch(() => null),
    ]);
    const configOf = (doc: unknown) => ((doc as { config?: Record<string, string> } | null)?.config ?? {}) as Record<string, string>;
    const links = {
        telegram: configOf(telegram).username ? `https://t.me/${configOf(telegram).username}` : "",
        viber: configOf(viber).uri ? `viber://pa?chatURI=${encodeURIComponent(configOf(viber).uri)}` : "",
        whatsapp: configOf(whatsapp).phone ? `https://wa.me/${configOf(whatsapp).phone.replace(/\D/g, "")}` : "",
    };

    return corsJson({ title, greeting, color, quick, links });
}
