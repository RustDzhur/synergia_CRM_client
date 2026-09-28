"use client";
import Script from "next/script";

// Чат на публичных страницах: тот же виджет, что CRM выдаёт в Settings → Integration → Online Chat.
// Он показывает окно посетителю и обменивается сообщениями с /api/webchat; пока отвечает бот,
// человек может подключиться к переписке из раздела «Онлайн-чат» и продолжить разговор сам.
// Токен не секрет — он всё равно виден в разметке страницы, — но привязан к конкретной фирме.
const WIDGET_TOKEN = "d206c7942ee379b931c9d5d58692f2942084";
const WIDGET_SRC = "https://www.firmspace.de/widget.js";

export default function ChatWidget() {
	return <Script src={WIDGET_SRC} data-token={WIDGET_TOKEN} strategy="afterInteractive" />;
}
