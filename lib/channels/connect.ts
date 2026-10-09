import { webhookPath, packSecrets, secretsOf } from "@/lib/integrations";
import { isPublicHttps } from "@/lib/appUrl";
import { randomToken } from "@/lib/crypto";
import { metaApp, whatsappVerifyToken } from "@/lib/platformSettings";
import { ProviderError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { exchangeMessengerCode, getPage, listUserPages, longLivedUserToken, looksLikeUserToken, messengerCredentialsProblem, messengerOauthUrl, setMessengerAppWebhook, subscribeMessengerPage } from "./messenger";
import { verifyPlivo } from "./plivo";
import { parseSip } from "./sip";
import { verifyTelnyx } from "./telnyx";
import { verifyVonage } from "./vonage";
import { connectTwilio, normalizePhone } from "./twilio";
import { deleteWebhook, getMe, getWebhookInfo, setWebhook } from "./telegram";
import { getAccount, removeViberWebhook, setViberWebhook } from "./viber";
import { checkToken as checkUkrposhtaToken } from "@/lib/ukrposhta";
import { requireIntegration } from "@/lib/finance/marketGuard";
import { saveDelivery } from "@/lib/finance/delivery";
import { saveFiscal } from "@/lib/finance/fiscal";
import { checkMarketplace, MARKETPLACES, type MarketplaceId } from "@/lib/marketplace";
import { PAY_PROVIDERS, verifyMonobankToken, verifyNowpaymentsToken } from "@/lib/payments";
import { appSubscriptions, discoverWhatsAppNumbers, exchangeEmbeddedCode, exchangeWhatsAppCode, getPhoneNumber, longLivedWhatsAppToken, setWhatsAppAppWebhook, subscribeApp, whatsappOauthUrl } from "./whatsapp";

// Общий адрес вебхука WhatsApp на всю платформу: Meta разрешает только один адрес на приложение,
// поэтому фирма определяется по номеру из события (см. app/api/webhooks/whatsapp/app)
const PLATFORM_WA_WEBHOOK = "/api/webhooks/whatsapp/app";

type Doc = any;
type Input = Record<string, unknown>;
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const need = (v: string, label: string) => {
    if (!v) throw new ProviderError(`${label} is required`);
    return v;
};

// ── Запись интеграции через Prisma ────────────────────────────────────────────────────────────────
// Логика подключения ниже написана как работа с документом (set/save, config как обычный объект).
// Чтобы не переписывать её целиком, здесь небольшая обёртка над Prisma: она держит поля записи
// и сохраняет их в базу. Принимает и готовую запись Prisma, и прежний Mongoose-документ.
function rowOf(owner: string, type: string, existing?: any, token?: string): Doc {
    const row: Doc = {
        id: existing?.id,
        owner: owner ?? existing?.owner,
        type: type ?? existing?.type,
        token: existing?.token ?? token,
        name: existing?.name ?? "",
        status: existing?.status ?? "",
        error: existing?.error ?? "",
        config: { ...((existing?.config ?? {}) as any) },
        secrets: existing?.secrets ?? "",
        set(pathOrObj: any, value?: unknown) {
            if (typeof pathOrObj === "string") {
                const [head, ...rest] = pathOrObj.split(".");
                if (rest.length) this[head] = { ...(this[head] ?? {}), [rest.join(".")]: value };
                else this[head] = value;
            } else {
                Object.assign(this, pathOrObj);
            }
            return this;
        },
        markModified() { return this; },
        async save() {
            const data = { name: this.name, status: this.status, error: this.error, config: this.config, secrets: this.secrets };
            if (this.id) await prisma.integration.update({ where: { id: this.id }, data: data as any });
            else {
                const created = await prisma.integration.create({ data: { owner: this.owner, type: this.type, token: this.token ?? randomToken(), ...(data as any) } });
                this.id = created.id;
            }
            return this;
        },
    };
    return row;
}

export interface ConnectResult { doc: Doc; warning?: string }

// ── Вход через Facebook (Messenger и WhatsApp) ────────────────────────────────────────────────────────
// Вместо копирования длинных токенов человек выбирает страницу или номер в окне самого Facebook, а
// токены мы получаем сами: код → короткий токен → долгий токен → страницы (или номера) с их токенами.
//
// App id не секрет — он идёт в адрес окна входа; app secret хранится зашифрованным (им же проверяется
// подпись вебхуков). Оба нужны на шаге возврата, поэтому до него лежат рядом с остальными секретами
// под именами pending*, а рабочее подключение не трогается: если человек передумает, прежнее останется.

export type MetaKind = "messenger" | "whatsapp";
const metaRedirect = (kind: MetaKind) => `/api/${kind}/oauth/callback`;
// секреты интеграции: строки плюс карты «id страницы (или номера) → токен», собранные на шаге возврата
type MetaSecrets = {
    appId?: string;
    appSecret?: string;
    pendingAppId?: string;
    pendingAppSecret?: string;
    pageAccessToken?: string;
    accessToken?: string;
    pageTokens?: Record<string, string>;
    numberTokens?: Record<string, string>;
};

/**
 * Приложение Meta — одно на платформу: ключи задаются администратором в кабинете (или переменными
 * META_APP_ID и META_APP_SECRET, как у рекламных кабинетов). Когда оно настроено, Messenger и WhatsApp
 * подключаются одной кнопкой, без полей с ключами — у клиента своего приложения Meta нет.
 */
export const metaAppConfigured = async () => {
    const a = await metaApp();
    return !!(a.appId && a.appSecret);
};

/** Начало входа: берём реквизиты приложения (введённые или платформенные), запоминаем секрет и отдаём адрес окна Facebook */
export async function startMetaOauth(owner: string, kind: MetaKind, enteredAppId: string, enteredSecret: string, origin: string, state: string): Promise<string> {
    const platform = await metaApp();
    const appId = enteredAppId || platform.appId;
    const appSecret = enteredSecret || platform.appSecret;
    if (!appId) throw new ProviderError("The Meta app is not configured: add the App ID and App Secret in the admin panel, or enter them here");
    if (!/^\d{6,20}$/.test(appId)) throw new ProviderError("The App ID is a number — copy it from Meta → Settings → Basic");
    if (appSecret.length < 20 || appSecret.length > 60) throw new ProviderError("The App Secret is a 32-character string — copy it from Meta → Settings → Basic");
    const doc = rowOf(owner, kind, await prisma.integration.findFirst({ where: { owner, type: kind } }), randomToken());
    // у ещё не подключённой интеграции секретов нет — читаем их только когда они есть
    const existing: MetaSecrets = doc.secrets ? secretsOf<MetaSecrets>(doc) : {};
    doc.secrets = packSecrets({ ...existing, pendingAppId: appId, pendingAppSecret: appSecret });
    await doc.save();
    const redirect = `${origin}${metaRedirect(kind)}`;
    return kind === "messenger" ? messengerOauthUrl(appId, redirect, state) : whatsappOauthUrl(appId, redirect, state);
}

/** Возврат из Facebook: получаем токены и выясняем, что доступно для подключения */
export async function completeMetaOauth(owner: string, kind: MetaKind, code: string, origin: string): Promise<{ options: Array<{ id: string; name: string }> }> {
    const doc = rowOf(owner, kind, await prisma.integration.findFirst({ where: { owner, type: kind } }));
    const secrets = doc.id ? secretsOf<MetaSecrets>(doc) : {};
    const appId = secrets.pendingAppId ?? String(doc?.config?.appId ?? "");
    const appSecret = secrets.pendingAppSecret ?? secrets.appSecret ?? "";
    if (!doc.id || !appId || !appSecret) throw new ProviderError("Start the connection again");
    const redirect = `${origin}${metaRedirect(kind)}`;

    // короткий токен годится только на один шаг, поэтому сразу меняем его на долгий
    const short = kind === "messenger" ? await exchangeMessengerCode(appId, appSecret, redirect, code) : await exchangeWhatsAppCode(appId, appSecret, redirect, code);
    const long = kind === "messenger" ? await longLivedUserToken(appId, appSecret, short) : await longLivedWhatsAppToken(appId, appSecret, short);

    let options: Array<{ id: string; name: string }> = [];
    const next: MetaSecrets = { ...secrets, appSecret };
    delete next.pendingAppSecret;
    if (kind === "messenger") {
        const pages = await listUserPages(long);
        if (!pages.length) throw new ProviderError(
            "Facebook не вернул ни одной страницы. Проверьте по порядку: приложение Meta переведено в режим Live (в режиме Development вход работает только у администраторов и тестеров приложения); в окне входа отмечены все запрашиваемые права; ваша учётная запись — администратор нужной страницы"
        );
        next.pageTokens = Object.fromEntries(pages.map((p) => [p.id, p.access_token]));
        options = pages.map((p) => ({ id: p.id, name: p.name }));
    } else {
        const numbers = await discoverWhatsAppNumbers(long);
        if (!numbers.length) throw new ProviderError(
            "В аккаунте WhatsApp Business нет ни одного номера. Проверьте: номер добавлен в аккаунт WhatsApp Business (Meta → WhatsApp → Настройки аккаунта → Номера); у приложения есть доступ к управлению WhatsApp Business (право whatsapp_business_management); бизнес-аккаунт принадлежит тому же портфолио, под которым вы входите"
        );
        next.numberTokens = Object.fromEntries(numbers.map((n) => [n.phoneNumberId, long]));
        options = numbers.map((n) => ({ id: n.phoneNumberId, name: n.verifiedName ? `${n.display} (${n.verifiedName})` : n.display }));
        doc.set("config", { ...(doc.config ?? {}), appId, wabaIds: Object.fromEntries(numbers.map((n) => [n.phoneNumberId, n.wabaId])), numbers: options });
    }
    doc.secrets = packSecrets(next);
    if (kind === "messenger") doc.set("config", { ...(doc.config ?? {}), appId, pages: options });
    doc.markModified("config");
    await doc.save();
    return { options };
}

/**
 * Подключение WhatsApp из окна Embedded Signup: клиент выбрал свой аккаунт в окне Meta, оттуда
 * пришли код и идентификаторы номера и аккаунта. Своё приложение в Meta for Developers ему для этого
 * не нужно — оно одно на платформу, а секрет остаётся только у нас на сервере.
 */
export async function connectWhatsAppEmbedded(
    owner: string,
    input: { code: string; phoneNumberId: string; wabaId: string },
    origin: string
): Promise<{ name: string; warning?: string }> {
    const { appId, appSecret } = await metaApp();
    if (!appId || !appSecret) throw new ProviderError("Приложение Meta не настроено администратором платформы — напишите в поддержку");
    if (!input.code) throw new ProviderError("Meta не вернула код подключения — попробуйте ещё раз");
    const token = await exchangeEmbeddedCode(appId, appSecret, input.code);

    // Аккаунт и номер: в окне Embedded Signup их присылает само окно; если чего-то не пришло —
    // находим по токену (у клиента обычно один аккаунт WhatsApp Business)
    let wabaId = input.wabaId;
    let phoneNumberId = input.phoneNumberId;
    if (!wabaId || !phoneNumberId) {
        const numbers = await discoverWhatsAppNumbers(token);
        const found = phoneNumberId ? numbers.find((n) => n.phoneNumberId === phoneNumberId) : numbers[0];
        if (!found) throw new ProviderError("В аккаунте WhatsApp Business нет ни одного номера — добавьте номер и повторите");
        wabaId = wabaId || found.wabaId;
        phoneNumberId = phoneNumberId || found.phoneNumberId;
    }

    const phone = await getPhoneNumber(phoneNumberId, token);
    const doc = rowOf(owner, "whatsapp", await prisma.integration.findFirst({ where: { owner, type: "whatsapp" } }), randomToken());
    const verifyToken = String(doc.config?.verifyToken || randomToken(8));
    doc.set({
        name: phone.display_phone_number || phone.verified_name || phoneNumberId,
        config: { ...(doc.config ?? {}), appId, wabaId, phoneNumberId, verifyToken, ...(phone.verified_name ? { botName: phone.verified_name } : {}) },
        secrets: packSecrets({ accessToken: token, appSecret }),
        status: "connected",
        error: "",
    });
    doc.markModified("config");

    // Подписка аккаунта на приложение и общий адрес вебхука: без них Meta не присылает сообщения
    const warnings: string[] = [];
    const subscribed = await subscribeApp(wabaId, token).then(() => "").catch((e) => (e instanceof ProviderError ? e.message : "Could not subscribe the app to the WhatsApp Business account"));
    if (subscribed) warnings.push(subscribed);
    const webhook = await setWhatsAppAppWebhook(appId, appSecret, `${origin}${PLATFORM_WA_WEBHOOK}`, await whatsappVerifyToken())
        .then(() => "")
        .catch((e) => (e instanceof ProviderError ? e.message : "Could not register the webhook in Meta"));
    if (webhook) warnings.push(webhook);

    await doc.save();
    return { name: doc.name, ...(warnings.length ? { warning: warnings.join("; ") } : {}) };
}

/** Подключение выбранного: токен выбранной страницы (или номера) уже лежит в секретах после возврата */
export async function connectMetaChoice(owner: string, kind: MetaKind, id: string, origin: string): Promise<{ name: string; warning?: string }> {
    const doc = rowOf(owner, kind, await prisma.integration.findFirst({ where: { owner, type: kind } }));
    if (!doc.id) throw new ProviderError("Start the connection again");
    const secrets = secretsOf<MetaSecrets>(doc);
    const appId = String(doc.config?.appId ?? "");
    const appSecret = secrets.appSecret ?? "";
    if (!appId || !appSecret) throw new ProviderError("Start the connection again");

    if (kind === "messenger") {
        const token = secrets.pageTokens?.[id];
        if (!token) throw new ProviderError("This page is no longer available — start the connection again");
        const page = await getPage(token);
        const verifyToken = String(doc.config?.verifyToken || randomToken(8));
        doc.set({
            name: page.name,
            config: { ...(doc.config ?? {}), appId, pageId: page.id, verifyToken },
            secrets: packSecrets({ pageAccessToken: token, appSecret }),
            status: "connected",
            error: "",
        });
        doc.markModified("config");

        // Подписка страницы на приложение: без неё Meta не доставляет события, и переписка не приходит.
        // Адрес вебхука и маркер подтверждения задаём тем же ходом через API — в кабинете Meta этот шаг
        // делают руками и легко вписывают туда ссылку на страницу CRM вместо нашего адреса.
        const warnings: string[] = [];
        const pageSubscription = await subscribeMessengerPage(page.id, token).catch((e) => (e instanceof ProviderError ? e.message : "Could not subscribe the page to the app"));
        if (pageSubscription) warnings.push(pageSubscription);
        const webhook = await setMessengerAppWebhook(appId, appSecret, `${origin}${webhookPath("messenger", String(doc.token))}`, verifyToken)
            .then(() => "")
            .catch((e) => (e instanceof ProviderError ? e.message : "Could not register the webhook in Meta"));
        // Если Meta не приняла настройку сама, значения остаются в окне — их можно вписать вручную
        if (webhook) warnings.push(`${webhook} — впишите адрес вебхука и маркер подтверждения из этого окна в Meta → Messenger → Webhooks вручную`);

        await doc.save();
        return { name: page.name, ...(warnings.length ? { warning: warnings.join("; ") } : {}) };
    }

    const token = secrets.numberTokens?.[id];
    const wabaId = String((doc.config?.wabaIds ?? {})[id] ?? "");
    if (!token || !wabaId) throw new ProviderError("This number is no longer available — start the connection again");
    const phone = await getPhoneNumber(id, token);
    const name = phone.display_phone_number || phone.verified_name || id;
    const verifyToken = String(doc.config?.verifyToken || randomToken(8));
    doc.set({
        name,
        config: { ...(doc.config ?? {}), appId, wabaId, phoneNumberId: id, verifyToken, ...(phone.verified_name ? { botName: phone.verified_name } : {}) },
        secrets: packSecrets({ accessToken: token, appSecret }),
        status: "connected",
        error: "",
    });
    doc.markModified("config");

    // Подписка аккаунта на приложение и адрес вебхука: без них Meta не присылает сообщения.
    // Как и у Messenger, настраиваем сами — в кабинете Meta этот шаг делают руками и легко путают поля.
    const warnings: string[] = [];
    const subscribed = await subscribeApp(wabaId, token).then(() => "").catch((e) => (e instanceof ProviderError ? e.message : "Could not subscribe the app to the WhatsApp Business account"));
    if (subscribed) warnings.push(subscribed);
    // Вебхук у приложения один на платформу, поэтому ставим общий адрес: он сам разбирает, какой фирме
    // адресовано событие (по номеру телефона, см. app/api/webhooks/whatsapp/app)
    const webhook = await setWhatsAppAppWebhook(appId, appSecret, `${origin}${PLATFORM_WA_WEBHOOK}`, await whatsappVerifyToken())
        .then(() => "")
        .catch((e) => (e instanceof ProviderError ? e.message : "Could not register the webhook in Meta"));
    if (webhook) warnings.push(`${webhook} — впишите в Meta адрес ${origin}${PLATFORM_WA_WEBHOOK} и маркер подтверждения ${await whatsappVerifyToken()} вручную`);

    await doc.save();
    return { name, ...(warnings.length ? { warning: warnings.join("; ") } : {}) };
}

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
    // Режим рынка: украинские интеграции не подключаются из немецкой фирмы и наоборот (ТЗ §3).
    // Пока страна не выбрана, проверка пропускает — выбор страны и есть первый шаг в разделе «Финансы».
    await requireIntegration(owner, type);
    const token = randomToken();
    let name = "";
    let config: Record<string, string> = {};
    let secrets: Record<string, string> = {};
    // предупреждение, которое возвращается вызывающему (интерфейс показывает его как подсказку)
    let messengerWarning = "";

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
            // uri — адрес публичного аккаунта: по нему посетитель открывает бота из виджета на сайте
            config = { botName: acc.name, uri: acc.uri ?? "" };
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
            // переносы строк из буфера обмена убираем: токен их не содержит, а Meta на них отвечает отказом
            const pageAccessToken = str(input.pageAccessToken, 500).replace(/\s+/g, "");
            const appSecret = str(input.appSecret, 200).replace(/\s+/g, "");
            const problem = messengerCredentialsProblem(pageAccessToken, appSecret);
            if (problem) throw new ProviderError(problem);
            const page = await getPage(pageAccessToken);
            name = page.name;
            config = { pageId: page.id, verifyToken: randomToken(8) };
            secrets = { pageAccessToken, appSecret };
            // Токен пользователя подключается без ошибки, но переписка в CRM не приходит: Meta доставляет
            // события только по странице. Подключение не отменяем — предупреждаем, что именно не так.
            if (await looksLikeUserToken(pageAccessToken)) {
                messengerWarning = "This is a user token, not a page token: incoming messages will not arrive. Use the Page access token (Meta → Messenger → Access tokens → Page, or «me/accounts» in the Graph API Explorer).";
            }
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
        case "ukrposhta": {
            const upToken = need(str(input.token, 200), "Bearer token");
            // Проверяем токен запросом к Укрпоште ДО сохранения: неверный токен иначе лежал бы в базе
            // и «работал» до первого обновления статуса
            await checkUkrposhtaToken(upToken);
            name = "Укрпошта";
            secrets = { token: upToken };
            break;
        }
        // Нова Пошта и Checkbox сохраняются профильными модулями: у них своя проверка до записи
        // (ключ НП — запросом к API, Checkbox — входом кассира) и своя форма конфигурации отправителя
        case "novaposhta": {
            return {
                doc: await saveDelivery(owner, {
                    apiKey: str(input.apiKey, 300),
                    senderCity: str(input.senderCity, 100),
                    senderWarehouse: str(input.senderWarehouse, 100),
                    senderName: str(input.senderName, 100),
                    senderPhone: str(input.senderPhone, 30),
                    ...(str(input.senderCityRef, 64) ? { senderCityRef: str(input.senderCityRef, 64) } : {}),
                }),
            };
        }
        case "checkbox": {
            return {
                doc: await saveFiscal(owner, {
                    licenseKey: str(input.licenseKey, 300),
                    login: str(input.login, 100),
                    password: str(input.password, 200),
                    cashierName: str(input.cashierName, 100),
                    department: str(input.department, 100),
                    autoFiscal: str(input.autoFiscal, 2) !== "0",
                }),
            };
        }
        // Маркетплейсы: перед сохранением тянем один заказ пробным подключением — так видно и
        // неверный ключ, и непривычный набор полей, а не через день в журнале синхронизации
        case "prom":
        case "rozetka":
        case "horoshop":
        case "olx": {
            const id = type as MarketplaceId;
            if (type === "horoshop") {
                config = { shop: need(str(input.shop, 200), "Shop domain") };
                secrets = { login: need(str(input.login, 200), "API login"), password: need(str(input.password, 200), "API password") };
            } else if (type === "olx") {
                secrets = { clientId: need(str(input.clientId, 200), "Client ID"), clientSecret: need(str(input.clientSecret, 200), "Client secret") };
            } else {
                secrets = { token: need(str(input.token, 500), "API token") };
            }
            // Комиссия площадки — процент, который она удерживает с заказа: по нему расход при
            // конвертации заявки в заказ, чтобы маржа не выглядела больше, чем есть
            const commission = String(input.commission ?? "").trim();
            if (commission) config = { ...config, commission: String(Math.max(0, Math.min(50, Number(commission.replace(",", ".")) || 0))) };
            // Пробное подключение — на несохранённой копии: проверка ничего не пишет в базу
            // пробное подключение — на несохранённой копии: проверка ничего не пишет в базу
            const probe = { owner, type, token, config, secrets: packSecrets(secrets) };
            const check = await checkMarketplace(probe);
            if (!check.ok) throw new ProviderError(check.message);
            name = MARKETPLACES[id].label;
            break;
        }
        // Приём оплаты: monobank и NOWPayments умеют проверить ключ сами, у LiqPay и WayForPay
        // такой возможности нет — их ключи проверит первая оплата, о чём честно говорим в предупреждении
        case "monobank": {
            const monoToken = need(str(input.token, 300), "Merchant token");
            await verifyMonobankToken(monoToken);
            name = PAY_PROVIDERS.monobank.label;
            secrets = { token: monoToken };
            break;
        }
        case "liqpay": {
            const publicKey = need(str(input.publicKey, 200), "Public key");
            const privateKey = need(str(input.privateKey, 200), "Private key");
            name = PAY_PROVIDERS.liqpay.label;
            secrets = { publicKey, privateKey };
            messengerWarning = "Ключі LiqPay збережено. Перевірити їх можна лише першою оплатою: створіть посилання на оплату невеликого рахунку й оплатіть його";
            break;
        }
        case "wayforpay": {
            const merchantAccount = need(str(input.merchantAccount, 200), "Merchant Account");
            const secretKey = need(str(input.secretKey, 200), "Secret Key");
            name = PAY_PROVIDERS.wayforpay.label;
            config = { merchantDomainName: str(input.merchantDomainName, 200) };
            secrets = { merchantAccount, secretKey };
            messengerWarning = "Ключі WayForPay збережено. Перевірити їх можна лише першою оплатою: створіть посилання на оплату невеликого рахунку й оплатіть його";
            break;
        }
        case "cryptopay": {
            const apiKey = need(str(input.apiKey, 300), "API key");
            const ipnSecret = need(str(input.ipnSecret, 300), "IPN secret");
            await verifyNowpaymentsToken(apiKey);
            name = PAY_PROVIDERS.cryptopay.label;
            secrets = { apiKey, ipnSecret };
            break;
        }
        // Узбекистан: Payme и Click вызывают адрес фирмы сами, поэтому ключи проверить запросом к провайдеру нельзя —
        // их проверяет песочница провайдера (docs/UZ_PAYMENTS.md). Деньги идут напрямую фирме.
        case "payme": {
            const merchantId = need(str(input.merchantId, 64), "Merchant ID");
            const key = need(str(input.key, 200), "Key");
            const testKey = str(input.testKey, 200);
            name = "Payme";
            config = { merchantId, mode: str(input.sandbox, 2) === "0" ? "live" : "test" };
            secrets = { key, ...(testKey ? { testKey } : {}) };
            break;
        }
        case "click": {
            const merchantId = need(str(input.merchantId, 64), "Merchant ID");
            const serviceId = need(str(input.serviceId, 64), "Service ID");
            const secretKey = need(str(input.secretKey, 200), "Secret key");
            name = "Click";
            config = { merchantId, serviceId, merchantUserId: str(input.merchantUserId, 64) };
            secrets = { secretKey };
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
    const doc = rowOf(owner, type, await prisma.integration.findFirst({ where: { owner, type } }));
    doc.set({ name, token, config, secrets: packSecrets(secrets), status: "connected", error: "" });
    await doc.save();
    // подписка на аккаунт WhatsApp Business: без неё Meta не станет присылать события, но подключение уже рабочее для отправки
    const subscribeWarning = config.wabaId ? await subscribeApp(config.wabaId, secrets.accessToken).then(() => "").catch((e) => (e instanceof ProviderError ? e.message : "Could not subscribe the app to the WhatsApp Business account")) : "";
    const warning = (type === "telegram" || type === "viber" ? await registerWebhook(doc, origin) : undefined) || subscribeWarning || messengerWarning || undefined;
    if (warning) {
        doc.status = "error";
        doc.error = warning;
    }
    await doc.save(); // registerWebhook мог изменить config (режим опроса Telegram)
    return { doc, warning };
}

export function webchatConfig(input: Input) {
    const color = str(input.color, 9);
    const time = (v: unknown, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(str(v, 5)) ? str(v, 5) : fallback);
    const tz = Number(input.tzOffset);
    const url = str(input.ctaUrl, 300);
    return {
        title: str(input.title, 60) || "Chat with us",
        greeting: str(input.greeting, 200) || "Hello! How can we help?",
        color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#C6FF4D",
        // Часы работы: по ним виджет честно говорит «ответим утром», а не оставляет человека ждать.
        // Дни — как в календаре JavaScript: 0 — воскресенье, 1–5 — будни.
        hoursFrom: time(input.hoursFrom, "09:00"),
        hoursTo: time(input.hoursTo, "18:00"),
        hoursDays: /^[0-6](-[0-6])?$/.test(str(input.hoursDays, 5)) ? str(input.hoursDays, 5) : "1-5",
        tzOffset: String(Number.isFinite(tz) ? Math.max(-840, Math.min(840, Math.round(tz))) : 0),
        // кнопка действия в окне — «начать бесплатно» и подобное
        ctaLabel: str(input.ctaLabel, 40),
        ctaUrl: /^https?:\/\//i.test(url) ? url : "",
        // Отвечать ли посетителю готовыми ответами бота. «0» — выключено, всё остальное — включено:
        // так же хранит выключатели автоматизация (см. enabled !== "0").
        botEnabled: str(input.botEnabled, 2) === "0" ? "0" : "1",
    };
}

// Проверка канала: у Telegram спрашиваем, дошёл ли до нас вебхук и почему нет (например, сайт закрыт паролем)
export async function checkIntegration(docIn: Doc, origin: string) {
    const doc = rowOf(docIn?.owner, docIn?.type, docIn);
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
    const docs = (await prisma.integration.findMany({ where: { owner, type: { in: ["telegram", "viber", "whatsapp"] } } })).map((r) => rowOf(r.owner, r.type, r));
    for (const d of docs) {
        if (d.type === "whatsapp") {
            await ensureWhatsAppWebhook(d, origin).catch(() => undefined);
            continue;
        }
        const stale = d.status === "error" || (d.type === "telegram" && d.config.polling === "1") || d.config.webhookOrigin !== origin;
        const recent = Date.now() - ((d as { updatedAt?: Date }).updatedAt?.getTime() ?? 0) < 60_000;
        if (stale && !recent) await reRegisterWebhook(d, origin).catch(() => undefined);
    }
}

// Адрес вебхука WhatsApp один на всё приложение Meta: его мог переписать другой кабинет (или он
// остался от прежней установки), и тогда события уходят не к нам — сообщения просто не приходят.
// Проверяем и при необходимости ставим свой адрес; чаще раза в 15 минут к Meta не ходим.
const WA_WEBHOOK_CHECK_MS = 15 * 60 * 1000;
async function ensureWhatsAppWebhook(doc: Doc, origin: string) {
    const appId = String(doc.config?.appId ?? "");
    const appSecret = String(secretsOf(doc).appSecret ?? "");
    if (!appId || !appSecret) return;
    const checkedAt = Number(doc.config?.webhookCheckedAt ?? 0);
    if (Date.now() - checkedAt < WA_WEBHOOK_CHECK_MS) return;
    const url = `${origin}${PLATFORM_WA_WEBHOOK}`;
    const subs = await appSubscriptions(appId, appSecret).catch(() => []);
    const fine = subs.some((s) => s.callback_url === url && s.active !== false);
    if (!fine) await setWhatsAppAppWebhook(appId, appSecret, url, await whatsappVerifyToken());
    doc.set("config", { ...doc.config, webhookCheckedAt: Date.now() });
    doc.markModified("config");
    await doc.save();
}

export async function reRegisterWebhook(docIn: Doc, origin: string) {
    const doc = rowOf(docIn?.owner, docIn?.type, docIn);
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
    const id = String(doc.id ?? doc._id ?? "");
    await prisma.message.deleteMany({ where: { integration: id } });
    await prisma.conversation.deleteMany({ where: { integration: id } });
    await prisma.integration.deleteMany({ where: { id } });
}
