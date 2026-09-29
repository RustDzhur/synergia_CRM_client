"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { TbMessages } from "react-icons/tb";
import { useIntegrationsStore } from "@/store/useIntegrationsStore";
import type { MessagingChannel } from "@/types/integrations";
import { CHANNEL_COLOR, CHANNEL_ICON } from "./channelMeta";

// Экран Chat and Calls, пока нет ни одной беседы. Если каналы уже подключены, показываем их и подсказку, что делать дальше
// (ведь беседа появляется, только когда кто-то напишет); если у канала проблема — показываем причину.
export default function ChatEmpty() {
	const t = useTranslations("collab");
	const locale = useLocale();
	const { items, loaded, load, patch } = useIntegrationsStore();

	useEffect(() => {
		load().then(() => {
			// у Telegram спрашиваем, доходят ли до нас сообщения (вебхук мог не зарегистрироваться или сайт закрыт паролем),
			// у WhatsApp — отвечает ли номер на сохранённый токен (Meta могла отозвать доступ)
			useIntegrationsStore.getState().items.filter((i) => i.type === "telegram" || i.type === "whatsapp").forEach((i) => patch(i.id, { action: "check" }));
		});
	}, [load, patch]);

	const channels = items.filter((i) => i.type !== "mail");
	// известную причину показываем на языке интерфейса; остальные тексты приходят от провайдера как есть
	const reason = (e: string) => (e.startsWith("Webhooks need a public https address") ? t("chErrNeedHttps") : e);
	const link = "fs-btn fs-btn-primary h-38";

	return (
		<div className="flex min-h-[calc(100vh-137px)] flex-col items-center justify-center gap-16 p-16 text-center md:min-h-[calc(100vh-110px)] md:p-30">
			<TbMessages size={48} className="text-[#8C948B]" />
			<p className="text-14 text-[#8c948b]">{t("chatsEmpty")}</p>

			{!loaded || channels.length === 0 ? (
				<>
					{loaded && <p className="max-w-[420px] text-12 text-[#8C948B]">{t("chatsEmptyHint")}</p>}
					{loaded && <Link href={`/${locale}/crm/settings/integration`} className={link}>{t("goIntegration")}</Link>}
				</>
			) : (
				<>
					<p className="max-w-[420px] text-12 text-[#8C948B]">{t("chatsWaitingHint")}</p>
					<ul className="flex w-full max-w-[520px] flex-col gap-12 text-left">
						{channels.map((c) => {
							const Icon = CHANNEL_ICON[c.type as MessagingChannel];
							const ok = c.status === "connected";
							return (
								<li key={c.id} className="fs-card p-16">
									<div className="flex items-center gap-10">
										<span style={{ color: CHANNEL_COLOR[c.type as MessagingChannel] }}><Icon size={22} /></span>
										<span className="min-w-0 flex-1 truncate text-13 font-medium text-[#f1f4ee]">{t(`ch_${c.type}`)} · {c.name}</span>
										<span className={`shrink-0 text-12 ${ok ? "text-[#c6ff4d]" : "text-[#e2a33c]"}`}>{ok ? t("chStatusOn") : t("chStatusWarn")}</span>
									</div>
									<p className="mt-8 text-12 text-[#8c948b]">{t(`hint_${c.type}`, { name: c.name })}</p>
									{!ok && c.error && <p className="mt-8 rounded-8 bg-[rgba(226,163,60,0.10)] p-10 text-12 text-[#e2a33c]">{reason(c.error)}</p>}
									{c.type === "telegram" && c.config.polling === "1" && <p className="mt-8 text-11 text-[#8C948B]">{t("chPollingInfo")}</p>}
								</li>
							);
						})}
					</ul>
					<Link href={`/${locale}/crm/settings/integration`} className={link}>{t("goIntegrationFix")}</Link>
				</>
			)}
		</div>
	);
}
