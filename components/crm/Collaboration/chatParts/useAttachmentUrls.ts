import { useEffect, useRef, useState } from "react";
import { authHeaders } from "@/store/crmApi";
import type { MessageDTO } from "@/types/integrations";

// Вложения подгружаются с авторизацией, поэтому в <img>/<audio> попадают ссылки на уже полученные файлы
export default function useAttachmentUrls(messages: MessageDTO[]) {
	const [urls, setUrls] = useState<Record<string, string>>({});
	const made = useRef<Record<string, string>>({});
	useEffect(() => {
		const pending = messages.filter((m) => m.attachment && !made.current[m.id]);
		if (pending.length === 0) return;
		let stop = false;
		(async () => {
			for (const m of pending) {
				try {
					const res = await fetch(`/api/messages/${m.id}/attachment`, { headers: authHeaders(false) });
					if (!res.ok) continue;
					const url = URL.createObjectURL(await res.blob());
					if (stop) return void URL.revokeObjectURL(url);
					made.current[m.id] = url;
					setUrls((u) => ({ ...u, [m.id]: url }));
				} catch {
					// файл не отдался — сообщение останется без вложения, переписка не ломается
				}
			}
		})();
		return () => { stop = true; };
	}, [messages]);
	useEffect(() => () => { Object.values(made.current).forEach((u) => URL.revokeObjectURL(u)); made.current = {}; }, []);
	return urls;
}
