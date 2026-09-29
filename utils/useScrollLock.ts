import { useEffect } from "react";

// Блокирует прокрутку страницы, пока открыто окно. Считает блокировки, поэтому вложенные окна
// (окно сделки + подтверждение) не снимают её раньше времени. Блокируем и html, и body:
// в globals.css у html свой overflow-x, поэтому прокручивается именно он.
let locks = 0;
let saved = { html: "", body: "" };

export function useScrollLock(active: boolean) {
	useEffect(() => {
		if (!active) return;
		if (locks === 0) {
			saved = { html: document.documentElement.style.overflow, body: document.body.style.overflow };
			document.documentElement.style.overflow = "hidden";
			document.body.style.overflow = "hidden";
		}
		locks += 1;
		return () => {
			locks -= 1;
			if (locks === 0) {
				document.documentElement.style.overflow = saved.html;
				document.body.style.overflow = saved.body;
			}
		};
	}, [active]);
}
