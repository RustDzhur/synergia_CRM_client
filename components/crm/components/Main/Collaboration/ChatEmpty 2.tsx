"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MdForum } from "react-icons/md";
import { useIntegrationsStore } from "@/app/store/useIntegrationsStore";
import type { MessagingChannel } from "@/app/types/integrations";
import { CHANNEL_COLOR, CHANNEL_ICON } from "./channelMeta";

// Экран Chat and Calls, пока нет ни одной беседы. Если каналы уже подключены, показываем их и подсказку, что делать дальше
// (ведь беседа появляется, только когда кто-то напишет); если у канала проблема — показываем причину.
export default function ChatEmpty() {
	const t = useTranslations("collab");
	const locale = useLocale();
	const { items, loaded, load, patch } = useIntegrationsStore();

	useEffect(() => {
		load().then(() => {
			// у Telegram спрашиваем, доходят ли до нас сообщения (вебхук мог не зарегистрироваться или сайт закрыт паролем)
			useIntegrationsStore.getState().items.filter((i) => i.type === "telegram").forEach((i) => patch(i.id, { action: "check" }));
		});
	}, [load, patch]);

	const channels = items.filter((i) => i.type !== "mail");
	// известную причину показываем на языке интерфейса; остальные тексты приходят от провайдера как есть
	const reason = (e: string) => (e.startsWith("Webhooks need a public https address") ? t("chErrNeedHttps") : e);
	const link = "rounded-4 bg-primaryColor px-24 py-12 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80";

	return (
		<div className="flex min-h-[calc(100vh-137px)] flex-col items-center justify-center gap-16 p-16 text-center md:min-h-[calc(100vh-110px)] md:p-30">
			<MdForum size={56} className="text-[#D9D9D9]" />
			<p className="text-18 text-[#666666]">{t("chatsEmpty")}</p>

			{!loaded || channels.length === 0 ? (
				<>
					{loaded && <p className="max-w-[420px] text-14 text-[#999999]">{t("chatsEmptyHint")}</p>}
					{loaded && <Link href={`/${locale}/crm/settings/integration`} className={link}>{t("goIntegration")}</Link>}
				</>
			) : (
				<>
					<p className="max-w-[420px] text-14 text-[#999999]">{t("chatsWaitingHint")}</p>
					<ul className="flex w-full max-w-[520px] flex-col gap-12 text-left">
						{channels.map((c) => {
							const Icon = CHANNEL_ICON[c.type as MessagingChannel];
							const ok = c.status === "connected";
							return (
								<li key={c.id} className="rounded-8 bg-white p-16 shadow-heroImage">
									<div className="flex items-center gap-10">
										<span style={{ color: CHANNEL_COLOR[c.type as MessagingChannel] }}><Icon size={24} /></span>
										<span className="min-w-0 flex-1 truncate text-16 font-medium text-[#333333]">{t(`ch_${c.type}`)} · {c.name}</span>
										<span className={`shrink-0 text-14 ${ok ? "text-[#009A2B]" : "text-[#D9822B]"}`}>{ok ? t("chStatusOn") : t("chStatusWarn")}</span>
									</div>
									<p className="mt-8 text-14 text-[#666666]">{t(`hint_${c.type}`, { name: c.name })}</p>
									{!ok && c.error && <p className="mt-8 rounded-4 bg-[#FFF6EA] p-8 text-14 text-[#8A5A1F]">{reason(c.error)}</p>}
									{c.type === "telegram" && c.config.polling === "1" && <p className="mt-8 text-12 text-[#999999]">{t("chPollingInfo")}</p>}
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
