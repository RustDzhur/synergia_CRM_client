"use client";
import { useEffect } from "react";
import { useLocale } from "next-intl";

// Чат на публичных страницах: тот же виджет, что CRM выдаёт в Settings → Integration → Online Chat.
//
// Виджет живёт в document.body и переживает переходы внутри приложения (лендинг → кабинет и обратно, смена
// языка — всё без перезагрузки страницы), поэтому ставим и снимаем его сами: при смене языка страницы окно
// поднимается заново и говорит на новом языке, а в кабинет виджет не попадает вовсе.
//
// Версия в адресе скрипта — чтобы браузер после обновления сайта не подставил старый виджет из кэша.
const WIDGET_TOKEN = "d206c7942ee379b931c9d5d58692f2942084";
// Виджет берём со своего домена, а не с боевого адреса: на локальной и тестовой сборке должна работать
// её же версия файла, иначе правки в public/widget.js видны только после заливки на прод
const WIDGET_BASE = "/widget.js";
const VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev";

// Окно виджета одно на страницу, а компонентов может оказаться несколько — считаем их сами
let mounts = 0;

const forget = () => {
	// виджет защищается от повторного запуска глобальным флагом; снимаем его, чтобы подключение работало снова
	try {
		delete (window as unknown as { __synergiaChat?: boolean }).__synergiaChat;
	} catch {
		(window as unknown as { __synergiaChat?: boolean }).__synergiaChat = false;
	}
};

const removeWidget = () => {
	document.querySelectorAll("script[data-firmspace-chat], div[data-firmspace-chat]").forEach((el) => el.remove());
	forget();
};

export default function ChatWidget() {
	const locale = useLocale();
	useEffect(() => {
		mounts++;
		removeWidget();
		const script = document.createElement("script");
		script.src = `${WIDGET_BASE}?v=${VERSION}`;
		script.setAttribute("data-token", WIDGET_TOKEN);
		// язык берём у страницы, а не у браузера: на немецком сайте окно должно быть немецким
		script.setAttribute("data-lang", locale);
		script.setAttribute("data-firmspace-chat", "1");
		script.async = true;
		document.body.appendChild(script);

		return () => {
			// снимаем виджет только когда уходит последний экземпляр компонента
			if (--mounts > 0) return;
			removeWidget();
		};
	}, [locale]);

	return null;
}
