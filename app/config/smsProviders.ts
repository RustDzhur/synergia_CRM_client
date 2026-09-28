// Каталог провайдеров СМС (Settings → Integration → SMS Provider). Как и у звонков, показываем только тех,
// чей способ подключения знаем точно:
//   twilio — родная интеграция: номер и адреса вебхуков настраиваются автоматически
//   vonage — ключ и секрет API; отправителем может быть буквенное имя («Firmspace»)
//   plivo  — auth_id и auth_token, отправка по Basic-авторизации
//   telnyx — ключ API в заголовке Bearer
// Входящие СМС принимает пока только Twilio: у остальных своя подпись вебхука, а принимать сообщения
// без проверки подписи нельзя — в беседу мог бы написать кто угодно. Отправка работает у всех.
export type SmsProviderId = "twilio" | "vonage" | "plivo" | "telnyx";

export interface SmsProviderDef {
	id: SmsProviderId;
	name: string;
	/** тип интеграции: у СМС-провайдеров каждому соответствует свой (в отличие от звонков, где типов два) */
	type: SmsProviderId;
}

export const SMS_PROVIDERS: SmsProviderDef[] = [
	{ id: "twilio", name: "Twilio", type: "twilio" },
	{ id: "vonage", name: "Vonage", type: "vonage" },
	{ id: "plivo", name: "Plivo", type: "plivo" },
	{ id: "telnyx", name: "Telnyx", type: "telnyx" },
];

/** Все типы интеграций, которые относятся к СМС: по ним карточка в настройках понимает, что подключено */
export const SMS_PROVIDER_TYPES = SMS_PROVIDERS.map((p) => p.type);
