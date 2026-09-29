// Каталог провайдеров звонков (Settings → Integration → Call Provider): клиент выбирает своего по логотипу, поля SIP
// подставляются автоматически. Двоих здесь нет умышленно: показываем только тех, чей способ подключения мы знаем точно.
//   twilio    — родная интеграция (ключи Twilio, всё настраивается автоматически)
//   telnyx    — SIP через WebSocket; адрес сервера — из документации Telnyx (нами на настоящем аккаунте не проверялся)
//   asterisk  — Asterisk / FreePBX / Issabel: свой сервер, порт и путь WebSocket по умолчанию у Asterisk — 8089 и /ws
//   freeswitch — свой сервер FreeSWITCH: WSS по умолчанию на порту 7443
//   custom    — любой другой оператор или АТС с SIP по WebSocket (wss://), поля вводятся вручную
export type CallProviderId = "twilio" | "telnyx" | "asterisk" | "freeswitch" | "custom";

export interface CallProviderDef {
	id: CallProviderId;
	name: string;
	type: "twilio" | "sip";
	server?: string; // значение по умолчанию, если оно одинаково у всех клиентов
	domain?: string;
	serverPlaceholder?: string;
	domainPlaceholder?: string;
}

export const CALL_PROVIDERS: CallProviderDef[] = [
	{ id: "twilio", name: "Twilio", type: "twilio" },
	{ id: "telnyx", name: "Telnyx", type: "sip", server: "wss://sip.telnyx.com:7443", domain: "sip.telnyx.com" },
	{ id: "asterisk", name: "Asterisk / FreePBX", type: "sip", serverPlaceholder: "wss://pbx.example.com:8089/ws", domainPlaceholder: "pbx.example.com" },
	{ id: "freeswitch", name: "FreeSWITCH", type: "sip", serverPlaceholder: "wss://pbx.example.com:7443", domainPlaceholder: "pbx.example.com" },
	{ id: "custom", name: "", type: "sip" }, // название — перевод «Other provider (manual)»
];

export const SIP_PROVIDER_IDS = CALL_PROVIDERS.filter((p) => p.type === "sip").map((p) => p.id);

// Короткое название для шапки звонилки: «Twilio», «Telnyx», «Asterisk / FreePBX»… или «SIP» для остальных
export function providerLabel(type: "twilio" | "sip", brand: string) {
	if (type === "twilio") return "Twilio";
	return CALL_PROVIDERS.find((p) => p.id === brand && p.id !== "custom")?.name || "SIP";
}
