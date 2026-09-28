"use client";
import { useEffect } from "react";

// Чат на публичных страницах: тот же виджет, что CRM выдаёт в Settings → Integration → Online Chat.
// В кабинет он попадать не должен, а лендинг переходит туда без перезагрузки страницы — поэтому одного
// тега <script> мало: при уходе с публичной части виджет убирается вместе со своим окном, а при возврате
// поднимается заново. Токен не секрет — он всё равно виден в разметке страницы, — но привязан к фирме.
const WIDGET_TOKEN = "d206c7942ee379b931c9d5d58692f2942084";
const WIDGET_SRC = "https://www.firmspace.de/widget.js";

const forget = () => {
	// виджет защищается от повторного запуска глобальным флагом; снимаем его, чтобы подключение работало снова
	try {
		delete (window as unknown as { __synergiaChat?: boolean }).__synergiaChat;
	} catch {
		(window as unknown as { __synergiaChat?: boolean }).__synergiaChat = false;
	}
};

export default function ChatWidget() {
	useEffect(() => {
		document.querySelectorAll("script[data-firmspace-chat]").forEach((el) => el.remove());
		forget();
		const s = document.createElement("script");
		s.src = WIDGET_SRC;
		s.setAttribute("data-token", WIDGET_TOKEN);
		s.setAttribute("data-firmspace-chat", "1");
		s.async = true;
		document.body.appendChild(s);

		return () => {
			// окно виджета живёт в document.body и переживает переход внутри приложения — убираем его вместе со скриптом
			document.querySelectorAll("script[data-firmspace-chat], div[data-firmspace-chat]").forEach((el) => el.remove());
			forget();
		};
	}, []);

	return null;
}
