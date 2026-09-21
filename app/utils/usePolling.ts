import { useEffect, useRef } from "react";

// Периодический опрос сервера (на Vercel нет постоянных соединений, поэтому «живые» сообщения — это опрос).
// Сразу вызывает fn, затем каждые ms миллисекунд; пока вкладка скрыта — не опрашивает, а при возврате обновляет сразу.
export function usePolling(fn: () => void | Promise<void>, ms: number, enabled = true) {
	const ref = useRef(fn);
	ref.current = fn;

	useEffect(() => {
		if (!enabled) return;
		const run = () => { if (!document.hidden) ref.current(); };
		run();
		const id = setInterval(run, ms);
		document.addEventListener("visibilitychange", run);
		return () => {
			clearInterval(id);
			document.removeEventListener("visibilitychange", run);
		};
	}, [ms, enabled]);
}
