import { connectDB } from "@/lib/mongodb";
import { findByToken } from "@/lib/integrations";
import { corsJson, corsPreflight } from "@/lib/channels/webchat";
import { getAccount } from "@/lib/channels/viber";
import { secretsOf } from "@/lib/integrations";
import { CHATBOT_FAQ } from "@/content/chatbotFaq";
import { tx } from "@/content/i18n";
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
    const { title, greeting, color, hoursFrom, hoursTo, hoursDays, tzOffset, ctaLabel, ctaUrl } = (integration.config ?? {}) as any;
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

    // У подключений, сделанных до появления адреса аккаунта, uri не сохранён: спрашиваем его у Viber
    // один раз и запоминаем — иначе кнопка Viber в виджете не появится, хотя канал подключён
    if (viber && !configOf(viber).uri) {
        try {
            const acc = await getAccount(secretsOf(viber).authToken);
            if (acc.uri) {
                await Integration.updateOne({ _id: viber._id }, { $set: { "config.uri": acc.uri } });
                configOf(viber).uri = acc.uri;
            }
        } catch {
            // не получилось — кнопки не будет, сам канал от этого не ломается
        }
    }

    const links = {
        telegram: configOf(telegram).username ? `https://t.me/${configOf(telegram).username}` : "",
        viber: configOf(viber).uri ? `viber://pa?chatURI=${encodeURIComponent(configOf(viber).uri)}` : "",
        whatsapp: configOf(whatsapp).phone ? `https://wa.me/${configOf(whatsapp).phone.replace(/\D/g, "")}` : "",
    };

    // Часы работы нужны виджету, чтобы честно сказать «ответим утром»; кнопка действия — чтобы посетителю
    // не искать «начать бесплатно» на странице
    const hours = { from: hoursFrom ?? "09:00", to: hoursTo ?? "18:00", days: hoursDays ?? "1-5", tzOffset: Number(tzOffset) || 0 };
    const cta = ctaUrl ? { label: ctaLabel ?? "", url: ctaUrl } : null;
    return corsJson({ title, greeting, color, quick, links, hours, cta });
}
