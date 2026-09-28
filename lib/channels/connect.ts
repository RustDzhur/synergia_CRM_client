import type { HydratedDocument } from "mongoose";
import { webhookPath, packSecrets, secretsOf } from "@/lib/integrations";
import { isPublicHttps } from "@/lib/appUrl";
import { randomToken } from "@/lib/crypto";
import { ProviderError } from "@/lib/http";
import Conversation from "@/models/Conversation";
import Integration from "@/models/Integration";
import Message from "@/models/Message";
import { getPage } from "./messenger";
import { verifyPlivo } from "./plivo";
import { parseSip } from "./sip";
import { verifyTelnyx } from "./telnyx";
import { verifyVonage } from "./vonage";
import { connectTwilio, normalizePhone } from "./twilio";
import { deleteWebhook, getMe, getWebhookInfo, setWebhook } from "./telegram";
import { getAccount, removeViberWebhook, setViberWebhook } from "./viber";
import { getPhoneNumber, subscribeApp } from "./whatsapp";

type Doc = HydratedDocument<any>;
type Input = Record<string, unknown>;
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const need = (v: string, label: string) => {
    if (!v) throw new ProviderError(`${label} is required`);
    return v;
};

export interface ConnectResult { doc: Doc; warning?: string }

// Регистрирует вебхук у Telegram / Viber. На localhost провайдеры до нас не достучатся — тогда подключение
// сохраняется, а вместо ошибки возвращается предупреждение (адрес можно перерегистрировать позже).
async function registerWebhook(doc: Doc, origin: string) {
    const url = `${origin}${webhookPath(doc.type, doc.token)}`;
    // Telegram без публичного адреса работает в режиме опроса (см. telegramPoll.ts): вебхук не нужен
    if (doc.type === "telegram" && !isPublicHttps(origin)) {
        try { await deleteWebhook(secretsOf(doc).botToken); } catch { /* вебхука и не было */ }
        doc.set("config.polling", "1");
        doc.markModified("config");
        return undefined;
    }
    if (doc.type === "telegram") {
        doc.set("config.polling", "");
        doc.markModified("config");
    }
    // WhatsApp вебхук не умеет регистрировать сам: адрес и verify token вводят в кабинете Meta (Settings → Integration)
    if (doc.type === "whatsapp") return undefined;
    if (!isPublicHttps(origin)) return "Webhooks need a public https address. Set APP_URL or deploy the site, then press «Register webhook».";
    try {
        if (doc.type === "telegram") await setWebhook(secretsOf(doc).botToken, url, secretsOf(doc).webhookSecret);
        if (doc.type === "viber") await setViberWebhook(secretsOf(doc).authToken, url);
        doc.set("config.webhookOrigin", origin); // по нему видно, что вебхук смотрит на нынешний адрес сайта
        doc.markModified("config");
        return undefined;
    } catch (e) {
        return e instanceof ProviderError ? e.message : "Webhook was not registered";
    }
}

export async function connectIntegration(owner: string, type: string, input: Input, origin: string): Promise<ConnectResult> {
    const token = randomToken();
    let name = "";
    let config: Record<string, string> = {};
    let secrets: Record<string, string> = {};

    switch (type) {
        case "telegram": {
            const botToken = need(str(input.botToken, 200), "Bot token");
            const me = await getMe(botToken);
            name = `@${me.username}`;
            config = { username: me.username };
            secrets = { botToken, webhookSecret: randomToken() };
            break;
        }
        case "viber": {
            const authToken = need(str(input.authToken, 200), "Auth token");
            const acc = await getAccount(authToken);
            name = acc.name;
            config = { botName: acc.name };
            secrets = { authToken };
            break;
        }
        case "whatsapp": {
            const phoneNumberId = need(str(input.phoneNumberId, 64), "Phone number ID");
            const accessToken = need(str(input.accessToken, 800), "Access token");
            const appSecret = need(str(input.appSecret, 200), "App secret");
            const phone = await getPhoneNumber(phoneNumberId, accessToken);
            name = phone.display_phone_number || phone.verified_name || phoneNumberId;
            // botName — отображаемое имя канала (как у Viber): в списках рядом с номером видно и название фирмы
            config = { phoneNumberId, verifyToken: randomToken(8), ...(phone.verified_name ? { botName: phone.verified_name } : {}) };
            // без подписки приложения на аккаунт WhatsApp Business Meta не присылает вебхуки; если id не указали — настроим в кабинете
            const wabaId = str(input.wabaId, 64);
            if (wabaId) config.wabaId = wabaId;
            secrets = { accessToken, appSecret };
            break;
        }
        case "messenger": {
            const pageAccessToken = need(str(input.pageAccessToken, 500), "Page access token");
            const appSecret = need(str(input.appSecret, 200), "App secret");
            const page = await getPage(pageAccessToken);
            name = page.name;
            config = { pageId: page.id, verifyToken: randomToken(8) };
            secrets = { pageAccessToken, appSecret };
            break;
        }
        case "twilio": {
            const accountSid = need(str(input.accountSid, 64), "Account SID");
            const authToken = need(str(input.authToken, 64), "Auth token");
            const phone = normalizePhone(str(input.phone, 30));
            if (!phone) throw new ProviderError("Enter the phone number in international format, e.g. +4915123456789");
            const linked = await connectTwilio(accountSid, authToken, phone, `${origin}${webhookPath("twilio", token)}`);
            name = linked.phone; // номер в том виде, как его хранит Twilio
            config = { phone: linked.phone };
            secrets = { ...linked.secrets };
            break;
        }
        case "vonage": {
            const apiKey = need(str(input.apiKey, 100), "API key");
            const apiSecret = need(str(input.apiSecret, 200), "API secret");
            // У Vonage отправителем может быть буквенное имя, поэтому номер не приводим к формату
            const sender = need(str(input.phone, 30), "Sender name or number");
            await verifyVonage({ apiKey, apiSecret });
            name = sender;
            config = { phone: sender };
            secrets = { apiKey, apiSecret };
            break;
        }
        case "plivo": {
            const authId = need(str(input.authId, 64), "Auth ID");
            const authToken = need(str(input.authToken, 200), "Auth token");
            const phone = normalizePhone(str(input.phone, 30));
            if (!phone) throw new ProviderError("Enter the phone number in international format, e.g. +4915123456789");
            await verifyPlivo({ authId, authToken });
            name = phone;
            config = { phone };
            secrets = { authId, authToken };
            break;
        }
        case "telnyx": {
            const apiKey = need(str(input.apiKey, 200), "API key");
            const phone = normalizePhone(str(input.phone, 30));
            if (!phone) throw new ProviderError("Enter the phone number in international format, e.g. +4915123456789");
            await verifyTelnyx({ apiKey });
            name = phone;
            config = { phone };
            secrets = { apiKey };
            break;
        }
        case "sip": {
            // Пароль проверяет браузер до сохранения (регистрация на сервере провайдера), здесь — только разбор и хранение
            const sip = parseSip(input);
            name = `${sip.config.username}@${sip.config.domain}`;
            config = { ...sip.config };
            secrets = sip.secrets;
            break;
        }
        case "webchat":
            name = "Online chat";
            config = webchatConfig(input);
            break;
        default:
            throw new ProviderError("Unknown integration type");
    }

    // одно подключение каждого типа: повторное подключение обновляет существующее (беседы сохраняются)
    const doc = (await Integration.findOne({ owner, type })) ?? new Integration({ owner, type });
    doc.set({ name, token, config, secrets: packSecrets(secrets), status: "connected", error: "" });
    await doc.save();
    // подписка на аккаунт WhatsApp Business: без неё Meta не станет присылать события, но подключение уже рабочее для отправки
    const subscribeWarning = config.wabaId ? await subscribeApp(config.wabaId, secrets.accessToken).then(() => "").catch((e) => (e instanceof ProviderError ? e.message : "Could not subscribe the app to the WhatsApp Business account")) : "";
    const warning = (type === "telegram" || type === "viber" ? await registerWebhook(doc, origin) : undefined) || subscribeWarning || undefined;
    if (warning) {
        doc.status = "error";
        doc.error = warning;
    }
    await doc.save(); // registerWebhook мог изменить config (режим опроса Telegram)
    return { doc, warning };
}

export function webchatConfig(input: Input) {
    const color = str(input.color, 9);
    return {
        title: str(input.title, 60) || "Chat with us",
        greeting: str(input.greeting, 200) || "Hello! How can we help?",
        color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#5EA8F5",
    };
}

// Проверка канала: у Telegram спрашиваем, дошёл ли до нас вебхук и почему нет (например, сайт закрыт паролем Vercel)
export async function checkIntegration(doc: Doc, origin: string) {
    // у WhatsApp проверяем доступ к номеру: токен мог истечь или номер отвязали от приложения
    if (doc.type === "whatsapp") {
        let message = "";
        try {
            await getPhoneNumber(doc.config.phoneNumberId, secretsOf(doc).accessToken);
        } catch (e) {
            message = e instanceof ProviderError ? e.message : "Could not reach the WhatsApp number";
        }
        doc.status = message ? "error" : "connected";
        doc.error = message;
        await doc.save();
        return;
    }
    if (doc.type !== "telegram" || doc.config.polling === "1") return;
    let message = "";
    try {
        const info = await getWebhookInfo(secretsOf(doc).botToken);
        const expected = `${origin}${webhookPath("telegram", doc.token)}`;
        if (!info.url) message = "Telegram has no webhook for this bot. Press «Register webhook».";
        else if (info.url !== expected) message = `The webhook points to another address (${new URL(info.url).host}). Press «Register webhook».`;
        else if (info.last_error_message) message = `Telegram cannot deliver messages to the site: ${info.last_error_message}`;
    } catch (e) {
        message = e instanceof ProviderError ? e.message : "Could not check the webhook";
    }
    doc.status = message ? "error" : "connected";
    doc.error = message;
    await doc.save();
}

// Самолечение: бота подключили с локального адреса (Telegram там работает опросом, Viber не регистрируется), с ошибкой или
// сайт переехал на другой домен — на боевом адресе перерегистрируем вебхук сами, когда пользователь открывает настройки или чат.
// Не чаще раза в минуту на канал, чтобы не бить по провайдерам при повторной ошибке.
export async function healWebhooks(owner: string, origin: string) {
    if (!isPublicHttps(origin)) return;
    const docs = await Integration.find({ owner, type: { $in: ["telegram", "viber"] } });
    for (const d of docs) {
        const stale = d.status === "error" || (d.type === "telegram" && d.config.polling === "1") || d.config.webhookOrigin !== origin;
        const recent = Date.now() - ((d as { updatedAt?: Date }).updatedAt?.getTime() ?? 0) < 60_000;
        if (stale && !recent) await reRegisterWebhook(d, origin).catch(() => undefined);
    }
}

export async function reRegisterWebhook(doc: Doc, origin: string) {
    const warning = await registerWebhook(doc, origin);
    doc.status = warning ? "error" : "connected";
    doc.error = warning ?? "";
    await doc.save();
    return warning;
}

// Отключение: снимаем вебхук у провайдера (если получится) и удаляем беседы этого канала
export async function removeIntegration(doc: Doc) {
    try {
        if (doc.type === "telegram") await deleteWebhook(secretsOf(doc).botToken);
        if (doc.type === "viber") await removeViberWebhook(secretsOf(doc).authToken);
    } catch { /* токен уже отозван или провайдер недоступен — интеграцию удаляем в любом случае */ }
    await Message.deleteMany({ integration: doc._id });
    await Conversation.deleteMany({ integration: doc._id });
    await Integration.deleteOne({ _id: doc._id });
}
