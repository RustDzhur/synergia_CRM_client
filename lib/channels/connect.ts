import type { HydratedDocument } from "mongoose";
import { webhookPath, packSecrets, secretsOf } from "@/lib/integrations";
import { isPublicHttps } from "@/lib/appUrl";
import { randomToken } from "@/lib/crypto";
import { ProviderError } from "@/lib/http";
import Conversation from "@/models/Conversation";
import Integration from "@/models/Integration";
import Message from "@/models/Message";
import { getPage } from "./messenger";
import { connectTwilio, normalizePhone } from "./twilio";
import { deleteWebhook, getMe, setWebhook } from "./telegram";
import { getAccount, removeViberWebhook, setViberWebhook } from "./viber";

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
    if (!isPublicHttps(origin)) return "Webhooks need a public https address. Set APP_URL or deploy the site, then press «Register webhook».";
    try {
        if (doc.type === "telegram") await setWebhook(secretsOf(doc).botToken, url, secretsOf(doc).webhookSecret);
        if (doc.type === "viber") await setViberWebhook(secretsOf(doc).authToken, url);
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
            const twilioSecrets = await connectTwilio(accountSid, authToken, phone, `${origin}${webhookPath("twilio", token)}`);
            name = phone;
            config = { phone };
            secrets = { ...twilioSecrets };
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
    const warning = type === "telegram" || type === "viber" ? await registerWebhook(doc, origin) : undefined;
    if (warning) {
        doc.status = "error";
        doc.error = warning;
        await doc.save();
    }
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
