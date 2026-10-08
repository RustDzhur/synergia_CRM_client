import { prisma } from "@/lib/prisma";

// Реестр паспортов интеграций (docs/TZ_MASTER.md §6): что за сервис, для каких рынков, какие поля нужны, где взять ключ, в каком он статусе.
// Начальные паспорта лежат в коде, поверх них действуют записи IntegrationManifest из базы (администратор платформы меняет статус и тексты без деплоя).
// Подключает всегда человек: ключи получает он, договор подписывает он. Секреты через чат не ходят — только через защищённую форму/маршрут.

export type ManifestStatus = "available" | "beta" | "planned";
export type ManifestKind = "messenger" | "calls" | "sms" | "delivery" | "marketplace" | "payment" | "fiscal" | "rates" | "efaktura" | "bank";
export type Lang = "de" | "en" | "ua" | "uz";

export interface ManifestField { key: string; secret: boolean; required: boolean }
export interface Manifest {
    key: string;
    kind: ManifestKind;
    title: string;
    /** Рынки, где сервис доступен; пусто — везде. */
    markets: string[];
    status: ManifestStatus;
    fields: ManifestField[];
    /** Куда идти за ключом (кабинет провайдера). */
    url?: string;
    /** Откуда сведения о статусе/полях: код подключения или документ. */
    source: string;
    /** Подключение уже реализовано в connectIntegration (иначе — только паспорт). */
    connectable: boolean;
    /** Нужен договор с провайдером до получения ключей. */
    needsContract?: boolean;
    version: number;
}

const f = (key: string, secret = true, required = true): ManifestField => ({ key, secret, required });
const CODE = "lib/channels/connect.ts";
const m = (x: Omit<Manifest, "version" | "connectable" | "source"> & Partial<Pick<Manifest, "connectable" | "source">>): Manifest => ({ connectable: true, source: CODE, version: 1, ...x });

export const MANIFEST_SEED: Manifest[] = [
    m({ key: "telegram", kind: "messenger", title: "Telegram", markets: [], status: "available", fields: [f("botToken")], url: "https://t.me/BotFather" }),
    m({ key: "viber", kind: "messenger", title: "Viber", markets: [], status: "available", fields: [f("authToken")], url: "https://partners.viber.com" }),
    m({ key: "whatsapp", kind: "messenger", title: "WhatsApp Business", markets: [], status: "available", fields: [f("phoneNumberId", false), f("accessToken"), f("appSecret"), f("wabaId", false, false)], url: "https://developers.facebook.com" }),
    m({ key: "messenger", kind: "messenger", title: "Facebook Messenger", markets: [], status: "available", fields: [f("pageAccessToken"), f("appSecret")], url: "https://developers.facebook.com" }),
    m({ key: "webchat", kind: "messenger", title: "Web chat", markets: [], status: "available", fields: [] }),
    m({ key: "twilio", kind: "calls", title: "Twilio", markets: [], status: "available", fields: [f("accountSid", false), f("authToken"), f("phone", false)], url: "https://console.twilio.com" }),
    m({ key: "sip", kind: "calls", title: "SIP", markets: [], status: "available", fields: [] }),
    m({ key: "vonage", kind: "sms", title: "Vonage", markets: [], status: "available", fields: [f("apiKey", false), f("apiSecret"), f("phone", false)], url: "https://dashboard.nexmo.com" }),
    m({ key: "plivo", kind: "sms", title: "Plivo", markets: [], status: "available", fields: [f("authId", false), f("authToken"), f("phone", false)], url: "https://console.plivo.com" }),
    m({ key: "telnyx", kind: "sms", title: "Telnyx", markets: [], status: "available", fields: [f("apiKey"), f("phone", false)], url: "https://portal.telnyx.com" }),
    m({ key: "novaposhta", kind: "delivery", title: "Nova Poshta", markets: ["UA"], status: "available", fields: [f("apiKey"), f("senderCity", false), f("senderWarehouse", false), f("senderName", false), f("senderPhone", false)], url: "https://new.novaposhta.ua" }),
    m({ key: "ukrposhta", kind: "delivery", title: "Ukrposhta", markets: ["UA"], status: "available", fields: [f("token")], url: "https://www.ukrposhta.ua" }),
    m({ key: "checkbox", kind: "fiscal", title: "Checkbox", markets: ["UA"], status: "available", fields: [f("licenseKey"), f("login", false), f("password"), f("cashierName", false, false), f("department", false, false)], url: "https://my.checkbox.ua" }),
    m({ key: "prom", kind: "marketplace", title: "Prom.ua", markets: ["UA"], status: "available", fields: [f("token")], url: "https://my.prom.ua" }),
    m({ key: "rozetka", kind: "marketplace", title: "Rozetka", markets: ["UA"], status: "available", fields: [f("login", false), f("password")] }),
    m({ key: "horoshop", kind: "marketplace", title: "Horoshop", markets: ["UA"], status: "available", fields: [f("shop", false), f("login", false), f("password")] }),
    m({ key: "olx", kind: "marketplace", title: "OLX", markets: ["UA"], status: "available", fields: [f("clientId", false), f("clientSecret")] }),
    m({ key: "monobank", kind: "payment", title: "monobank acquiring", markets: ["UA"], status: "available", fields: [f("token")], url: "https://web.monobank.ua", needsContract: true }),
    m({ key: "liqpay", kind: "payment", title: "LiqPay", markets: ["UA"], status: "available", fields: [f("publicKey", false), f("privateKey")], url: "https://www.liqpay.ua", needsContract: true }),
    m({ key: "wayforpay", kind: "payment", title: "WayForPay", markets: ["UA"], status: "available", fields: [f("merchantAccount", false), f("secretKey"), f("merchantDomainName", false, false)], url: "https://wayforpay.com", needsContract: true }),
    m({ key: "cryptopay", kind: "payment", title: "Crypto Pay", markets: ["UA"], status: "available", fields: [f("apiKey"), f("ipnSecret")] }),
    // Узбекистан (§6.3): available — только то, что работает без договоров; остальное planned, кнопка не показывается
    m({ key: "cbu", kind: "rates", title: "CBU exchange rates", markets: ["UZ"], status: "available", fields: [], connectable: false, source: "lib/finance/rates.ts" }),
    m({ key: "didox", kind: "efaktura", title: "Didox (ЭСФ)", markets: ["UZ"], status: "planned", fields: [], connectable: false, needsContract: true, source: "docs/TZ_MASTER.md §6.3" }),
    m({ key: "faktura_uz", kind: "efaktura", title: "Faktura.uz (ЭСФ)", markets: ["UZ"], status: "planned", fields: [], connectable: false, needsContract: true, source: "docs/TZ_MASTER.md §6.3" }),
    m({ key: "payme", kind: "payment", title: "Payme", markets: ["UZ"], status: "planned", fields: [], connectable: false, needsContract: true, source: "docs/TZ_MASTER.md §6.3" }),
    m({ key: "click", kind: "payment", title: "Click", markets: ["UZ"], status: "planned", fields: [], connectable: false, needsContract: true, source: "docs/TZ_MASTER.md §6.3" }),
    m({ key: "uzum", kind: "payment", title: "Uzum", markets: ["UZ"], status: "planned", fields: [], connectable: false, needsContract: true, source: "docs/TZ_MASTER.md §6.3" }),
    m({ key: "atmos", kind: "payment", title: "ATMOS", markets: ["UZ"], status: "planned", fields: [], connectable: false, needsContract: true, source: "docs/TZ_MASTER.md §6.3" }),
    m({ key: "uz_kassa", kind: "fiscal", title: "Online cash register (UZ)", markets: ["UZ"], status: "planned", fields: [], connectable: false, needsContract: true, source: "docs/TZ_MASTER.md §6.3" }),
    m({ key: "uz_banks", kind: "bank", title: "Banks of Uzbekistan", markets: ["UZ"], status: "planned", fields: [], connectable: false, needsContract: true, source: "docs/TZ_MASTER.md §6.3, §7.3" }),
];

// ── тексты (по виду сервиса; название — бренд, не переводится) ─────────────────────────────────────────────

export const KIND_TEXT: Record<ManifestKind, Record<Lang, { desc: string; steps: string }>> = {
    messenger: {
        en: { desc: "Receive and answer customer messages in the CRM.", steps: "Open {title}, create the bot/app or take the access data, then enter it in the secure form." },
        de: { desc: "Kundennachrichten im CRM empfangen und beantworten.", steps: "Öffnen Sie {title}, legen Sie Bot/App an oder entnehmen Sie die Zugangsdaten und tragen Sie sie im geschützten Formular ein." },
        ua: { desc: "Отримуйте та відповідайте на повідомлення клієнтів у CRM.", steps: "Відкрийте {title}, створіть бота/додаток або візьміть дані доступу й введіть їх у захищеній формі." },
        uz: { desc: "Mijoz xabarlarini CRMda qabul qiling va javob bering.", steps: "{title} ni oching, bot/ilova yarating yoki kirish ma’lumotlarini oling va himoyalangan shaklga kiriting." },
    },
    calls: {
        en: { desc: "Calls from the CRM through your telephony provider.", steps: "Sign in to {title}, copy the account data and the number, enter them in the secure form." },
        de: { desc: "Anrufe aus dem CRM über Ihren Telefonanbieter.", steps: "Melden Sie sich bei {title} an, kopieren Sie Kontodaten und Nummer und tragen Sie sie im geschützten Formular ein." },
        ua: { desc: "Дзвінки з CRM через вашого телефонного провайдера.", steps: "Увійдіть у {title}, скопіюйте дані облікового запису та номер і введіть їх у захищеній формі." },
        uz: { desc: "CRMdan telefoniya provayderingiz orqali qo‘ng‘iroqlar.", steps: "{title} ga kiring, hisob ma’lumotlari va raqamni nusxalab, himoyalangan shaklga kiriting." },
    },
    sms: {
        en: { desc: "Send SMS to customers.", steps: "Sign in to {title}, create an API key and a sender number, enter them in the secure form." },
        de: { desc: "SMS an Kunden senden.", steps: "Melden Sie sich bei {title} an, erstellen Sie einen API-Schlüssel und eine Absendernummer und tragen Sie sie im geschützten Formular ein." },
        ua: { desc: "Надсилання SMS клієнтам.", steps: "Увійдіть у {title}, створіть API-ключ і номер відправника та введіть їх у захищеній формі." },
        uz: { desc: "Mijozlarga SMS yuborish.", steps: "{title} ga kiring, API kalit va jo‘natuvchi raqamini yarating va himoyalangan shaklga kiriting." },
    },
    delivery: {
        en: { desc: "Create shipping waybills from orders.", steps: "Get the API key in your {title} account and enter it with the sender data in the secure form." },
        de: { desc: "Versandscheine aus Bestellungen erstellen.", steps: "Holen Sie den API-Schlüssel in Ihrem {title}-Konto und tragen Sie ihn mit den Absenderdaten im geschützten Formular ein." },
        ua: { desc: "Створення накладних із замовлень.", steps: "Отримайте API-ключ у кабінеті {title} і введіть його з даними відправника в захищеній формі." },
        uz: { desc: "Buyurtmalardan yuk xatlarini yaratish.", steps: "{title} kabinetidan API kalitni oling va jo‘natuvchi ma’lumotlari bilan himoyalangan shaklga kiriting." },
    },
    marketplace: {
        en: { desc: "Pull marketplace orders into the CRM.", steps: "Create API access in your {title} seller account and enter it in the secure form." },
        de: { desc: "Marktplatz-Bestellungen ins CRM übernehmen.", steps: "Richten Sie im {title}-Verkäuferkonto einen API-Zugang ein und tragen Sie ihn im geschützten Formular ein." },
        ua: { desc: "Підтягування замовлень з майданчика в CRM.", steps: "Створіть API-доступ у кабінеті продавця {title} і введіть його в захищеній формі." },
        uz: { desc: "Savdo maydoni buyurtmalarini CRMga yuklash.", steps: "{title} sotuvchi kabinetida API ruxsat yarating va himoyalangan shaklga kiriting." },
    },
    payment: {
        en: { desc: "Accept payments by card; a paid invoice is marked paid automatically.", steps: "A contract with {title} is needed first. After it, copy the merchant keys from the {title} account and enter them in the secure form." },
        de: { desc: "Kartenzahlungen annehmen; bezahlte Rechnungen werden automatisch als bezahlt markiert.", steps: "Zuerst ist ein Vertrag mit {title} nötig. Danach kopieren Sie die Händlerschlüssel aus dem {title}-Konto und tragen sie im geschützten Formular ein." },
        ua: { desc: "Приймайте оплату карткою; оплачений рахунок позначається сам.", steps: "Спершу потрібен договір з {title}. Після нього скопіюйте ключі мерчанта з кабінету {title} і введіть їх у захищеній формі." },
        uz: { desc: "Karta orqali to‘lovni qabul qiling; to‘langan hisob-faktura o‘zi belgilanadi.", steps: "Avval {title} bilan shartnoma kerak. Undan keyin {title} kabinetidan kalitlarni nusxalab, himoyalangan shaklga kiriting." },
    },
    fiscal: {
        en: { desc: "Fiscal receipts for payments.", steps: "A licence/contract with {title} is needed first; then enter the access data in the secure form." },
        de: { desc: "Fiskalbelege für Zahlungen.", steps: "Zuerst ist eine Lizenz/ein Vertrag mit {title} nötig; dann die Zugangsdaten im geschützten Formular eintragen." },
        ua: { desc: "Фіскальні чеки для оплат.", steps: "Спершу потрібна ліцензія/договір з {title}; потім введіть дані доступу в захищеній формі." },
        uz: { desc: "To‘lovlar uchun fiskal cheklar.", steps: "Avval {title} bilan litsenziya/shartnoma kerak; keyin kirish ma’lumotlarini himoyalangan shaklga kiriting." },
    },
    rates: {
        en: { desc: "Official exchange rates of the Central Bank.", steps: "No keys needed." },
        de: { desc: "Offizielle Wechselkurse der Zentralbank.", steps: "Keine Schlüssel nötig." },
        ua: { desc: "Офіційні курси валют центрального банку.", steps: "Ключі не потрібні." },
        uz: { desc: "Markaziy bankning rasmiy valyuta kurslari.", steps: "Kalit kerak emas." },
    },
    efaktura: {
        en: { desc: "Sending e-invoices (ESF) to the operator.", steps: "Not available yet: it needs a contract and API access with the operator." },
        de: { desc: "E-Rechnungen (ESF) an den Operator senden.", steps: "Noch nicht verfügbar: Vertrag und API-Zugang beim Operator sind nötig." },
        ua: { desc: "Передача електронних рахунків-фактур (ЕСФ) оператору.", steps: "Поки недоступно: потрібні договір і доступ до API оператора." },
        uz: { desc: "Elektron hisob-fakturalarni (ESF) operatorga yuborish.", steps: "Hozircha mavjud emas: operator bilan shartnoma va API ruxsati kerak." },
    },
    bank: {
        en: { desc: "Bank statement connection.", steps: "Not available yet: until the regulator publishes rules for third-party providers, import the statement as a file." },
        de: { desc: "Bankanbindung für Kontoauszüge.", steps: "Noch nicht verfügbar: Kontoauszug als Datei importieren." },
        ua: { desc: "Підключення банку для виписок.", steps: "Поки недоступно: імпортуйте виписку файлом." },
        uz: { desc: "Bank ko‘chirmasini ulash.", steps: "Hozircha mavjud emas: ko‘chirmani fayl sifatida import qiling." },
    },
};

export const FIELD_LABELS: Record<string, Record<Lang, string>> = {
    botToken: { en: "Bot token", de: "Bot-Token", ua: "Токен бота", uz: "Bot tokeni" },
    authToken: { en: "Auth token", de: "Auth-Token", ua: "Токен авторизації", uz: "Auth token" },
    token: { en: "API token", de: "API-Token", ua: "API-токен", uz: "API token" },
    apiKey: { en: "API key", de: "API-Schlüssel", ua: "API-ключ", uz: "API kalit" },
    apiSecret: { en: "API secret", de: "API-Secret", ua: "API-секрет", uz: "API sirli kalit" },
    secretKey: { en: "Secret key", de: "Geheimer Schlüssel", ua: "Секретний ключ", uz: "Maxfiy kalit" },
    publicKey: { en: "Public key", de: "Öffentlicher Schlüssel", ua: "Публічний ключ", uz: "Ochiq kalit" },
    privateKey: { en: "Private key", de: "Privater Schlüssel", ua: "Приватний ключ", uz: "Yopiq kalit" },
    login: { en: "Login", de: "Login", ua: "Логін", uz: "Login" },
    password: { en: "Password", de: "Passwort", ua: "Пароль", uz: "Parol" },
    phone: { en: "Phone number", de: "Telefonnummer", ua: "Номер телефону", uz: "Telefon raqami" },
};

export const KINDS = Object.keys(KIND_TEXT) as ManifestKind[];
const pickLang = (l: string): Lang => (l === "de" || l === "ua" || l === "uz" ? l : "en");

export interface ManifestView extends Manifest { description: string; steps: string; fieldLabels: Record<string, string> }

export function describeManifest(mf: Manifest, locale = "en"): ManifestView {
    const lang = pickLang(locale);
    const tx = KIND_TEXT[mf.kind][lang];
    const fieldLabels: Record<string, string> = {};
    for (const fl of mf.fields) fieldLabels[fl.key] = FIELD_LABELS[fl.key]?.[lang] ?? FIELD_LABELS[fl.key]?.en ?? fl.key;
    return { ...mf, description: tx.desc, steps: tx.steps.replace(/\{title\}/g, mf.title), fieldLabels };
}

// ── реестр с накладкой из базы ──────────────────────────────────────────────────────────────────────────

const STATUSES = ["available", "beta", "planned"];

export async function listManifests(): Promise<Manifest[]> {
    const rows = await prisma.integrationManifest.findMany().catch(() => []);
    const over = new Map(rows.map((r) => [r.key, r]));
    const out: Manifest[] = MANIFEST_SEED.map((s) => {
        const o = over.get(s.key);
        if (!o) return s;
        return { ...s, status: STATUSES.includes(o.status) ? (o.status as ManifestStatus) : s.status, title: o.title || s.title, source: o.source || s.source, version: o.version };
    });
    return out;
}

export async function getManifest(key: string): Promise<Manifest | null> {
    return (await listManifests()).find((x) => x.key === key) ?? null;
}

/** Доступно ли это рынку фирмы (пустой список рынков — всем; рынок не выбран — всё, как в requireIntegration). */
export const forMarket = (mf: Manifest, market: string | null) => !market || mf.markets.length === 0 || mf.markets.includes(market);

/** Что показывать человеку: planned не показывается как кнопка и не подключается. */
export const connectableNow = (mf: Manifest) => mf.connectable && mf.status !== "planned";
