import type { CallProviderId } from "@/config/callProviders";
import type { IntegrationType } from "@/types/integrations";

export type Real = Exclude<IntegrationType, "mail">;
export interface FieldDef { key: string; label: string; secret?: boolean; optional?: boolean; placeholder?: string; type?: "color" | "bool" }

// Реквизиты каждого канала. Секретные поля после подключения не показываются — сервер хранит их зашифрованными.
export const FIELDS: Record<Real, FieldDef[]> = {
	twilio: [
		{ key: "accountSid", label: "intfAccountSid", placeholder: "AC…" },
		{ key: "authToken", label: "intfAuthToken", secret: true },
		{ key: "phone", label: "intfPhone", placeholder: "+4915123456789" },
	],
	// Остальные СМС-провайдеры: у каждого свои реквизиты и свой отправщик (lib/channels/vonage.ts и соседние)
	vonage: [
		{ key: "apiKey", label: "intfVonageKey" },
		{ key: "apiSecret", label: "intfVonageSecret", secret: true },
		{ key: "phone", label: "intfSender", placeholder: "Firmspace" },
	],
	plivo: [
		{ key: "authId", label: "intfPlivoId", placeholder: "MA…" },
		{ key: "authToken", label: "intfPlivoToken", secret: true },
		{ key: "phone", label: "intfPhone", placeholder: "+4915123456789" },
	],
	telnyx: [
		{ key: "apiKey", label: "intfTelnyxKey", secret: true, placeholder: "KEY…" },
		{ key: "phone", label: "intfPhone", placeholder: "+4915123456789" },
	],
	sip: [
		{ key: "server", label: "intfSipServer", placeholder: "wss://sip.example.com:7443" },
		{ key: "domain", label: "intfSipDomain", placeholder: "sip.example.com" },
		{ key: "username", label: "intfSipUser", placeholder: "1001" },
		{ key: "authUser", label: "intfSipAuthUser", optional: true },
		{ key: "password", label: "intfSipPassword", secret: true },
		{ key: "displayName", label: "intfSipName", optional: true, placeholder: "Firmspace CRM" },
	],
	// Нова Пошта: доставка для украинских фирм — ключ берётся в кабинете Нової Пошти (Налаштування → Безпека → API),
	// остальное (город и отделение отправки) подставляется в ТТН и правится в самом окне
	novaposhta: [
		{ key: "apiKey", label: "intfNpKey", secret: true },
		{ key: "senderCity", label: "intfNpSenderCity", placeholder: "Київ" },
		{ key: "senderWarehouse", label: "intfNpSenderWarehouse", optional: true, placeholder: "Відділення №1" },
		{ key: "senderName", label: "intfNpSenderName", optional: true, placeholder: "ФОП Шевченко Т. Г." },
		{ key: "senderPhone", label: "intfNpSenderPhone", optional: true, placeholder: "+380…" },
	],
	// Checkbox — ПРРО: ключ кассы и вход кассира берутся в кабинете Checkbox; автофискализация
	// пробивает чек сама, когда счёт оплачен (lib/finance/fiscal.ts)
	checkbox: [
		{ key: "licenseKey", label: "intfCbKey", secret: true },
		{ key: "login", label: "intfCbLogin", placeholder: "cashier@example.com" },
		{ key: "password", label: "intfCbPassword", secret: true },
		{ key: "cashierName", label: "intfCbCashier", optional: true, placeholder: "Шевченко Т. Г." },
		{ key: "autoFiscal", label: "intfCbAuto", type: "bool" },
	],
	// Маркетплейсы: заказы площадки приезжают в воронку сами (lib/marketplace). Токен берётся в кабинете продавца.
	prom: [{ key: "token", label: "intfMarketToken", secret: true, placeholder: "prom-api-token" }],
	rozetka: [{ key: "token", label: "intfMarketToken", secret: true, placeholder: "rozetka-api-token" }],
	horoshop: [
		{ key: "shop", label: "intfHoroshopShop", placeholder: "myshop.horoshop.ua" },
		{ key: "login", label: "intfHoroshopLogin", placeholder: "api@myshop.ua" },
		{ key: "password", label: "intfHoroshopPassword", secret: true },
	],
	olx: [
		{ key: "clientId", label: "intfOlxClientId" },
		{ key: "clientSecret", label: "intfOlxClientSecret", secret: true },
	],
	// Укрпошта: bearer-токен из кабинета (выдаётся после договора) — по нему тянем статус отправления
	ukrposhta: [{ key: "token", label: "intfUpToken", secret: true }],
	// Приём платежей: у каждой кассы свои ключи. Ссылка на оплату создаётся из счёта, а оплату
	// CRM узнаёт из вебхука провайдера (lib/payments).
	monobank: [{ key: "token", label: "intfMonoToken", secret: true, placeholder: "u…" }],
	liqpay: [
		{ key: "publicKey", label: "intfLiqpayPublic" },
		{ key: "privateKey", label: "intfLiqpayPrivate", secret: true },
	],
	wayforpay: [
		{ key: "merchantAccount", label: "intfWfpMerchant" },
		{ key: "merchantDomainName", label: "intfWfpDomain", optional: true, placeholder: "example.com" },
		{ key: "secretKey", label: "intfWfpSecret", secret: true },
	],
	cryptopay: [
		{ key: "apiKey", label: "intfCryptoKey", secret: true },
		{ key: "ipnSecret", label: "intfCryptoIpn", secret: true },
	],
	telegram: [{ key: "botToken", label: "intfBotToken", secret: true, placeholder: "123456:ABC…" }],
	viber: [{ key: "authToken", label: "intfViberToken", secret: true }],
	messenger: [
		{ key: "pageAccessToken", label: "intfPageToken", secret: true },
		{ key: "appSecret", label: "intfAppSecret", secret: true },
	],
	whatsapp: [
		{ key: "phoneNumberId", label: "intfWaPhoneId", placeholder: "123456789012345" },
		{ key: "accessToken", label: "intfWaToken", secret: true },
		{ key: "appSecret", label: "intfAppSecret", secret: true },
		{ key: "wabaId", label: "intfWaWabaId", optional: true, placeholder: "123456789012345" },
	],
	webchat: [
		{ key: "title", label: "intfChatTitle", placeholder: "Chat with us" },
		{ key: "greeting", label: "intfGreeting", placeholder: "Hello! How can we help?" },
		{ key: "color", label: "intfColor", type: "color" },
		// Бот отвечает посетителю готовыми ответами на частые вопросы (app/content/chatbotFaq.ts)
		{ key: "botEnabled", label: "intfBot", type: "bool" },
		// часы работы: вне них виджет честно говорит «ответим утром» и предлагает оставить контакт
		{ key: "hoursFrom", label: "intfHoursFrom", optional: true, placeholder: "09:00" },
		{ key: "hoursTo", label: "intfHoursTo", optional: true, placeholder: "18:00" },
		{ key: "hoursDays", label: "intfHoursDays", optional: true, placeholder: "1-5" },
		// кнопка действия в окне: текст и ссылка — чтобы её не искали на странице
		{ key: "ctaLabel", label: "intfCtaLabel", optional: true, placeholder: "Start free" },
		{ key: "ctaUrl", label: "intfCtaUrl", optional: true, placeholder: "https://…" },
	],
};

// «Call Provider» — провайдер звонков выбирается плитками с логотипами (app/config/callProviders.ts); одно SIP-подключение на пользователя
export const sipBrand = (cfg?: Record<string, string>) => (cfg?.provider || "custom") as CallProviderId;
