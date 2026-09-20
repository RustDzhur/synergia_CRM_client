"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { FaFacebook, FaFacebookMessenger, FaTelegram, FaViber } from "react-icons/fa";
import { MdCall, MdSensors, MdSms, MdSmartToy, MdWidgets } from "react-icons/md";
import SettingsTabs from "./SettingsTabs";

interface Integration {
	id: string;
	key: string; // ключ перевода в settings
	icon: IconType;
}

// Порядок как на десктопе в Figma: три колонки по три карточки.
const INTEGRATIONS: Integration[] = [
	{ id: "call", key: "intCall", icon: MdCall },
	{ id: "sms", key: "intSms", icon: MdSms },
	{ id: "viber", key: "intViber", icon: FaViber },
	{ id: "telegram", key: "intTelegram", icon: FaTelegram },
	{ id: "messenger", key: "intMessenger", icon: FaFacebookMessenger },
	{ id: "comments", key: "intComments", icon: FaFacebook },
	{ id: "chatbot", key: "intChatBot", icon: MdSmartToy },
	{ id: "onlinechat", key: "intOnlineChat", icon: MdSensors },
	{ id: "widget", key: "intWidget", icon: MdWidgets },
];

const STORAGE_KEY = "crm.integrations";
// В макете «Call Provider» подсвечен зелёным — это включённая интеграция; по умолчанию включаем её же.
const DEFAULT_ON = ["call"];

// Settings → Integration (/crm/settings/integration). Настоящих подключений пока нет (тестовый режим):
// нажатие включает/выключает карточку, состояние хранится в браузере (localStorage).
export default function IntegrationSettings() {
	const t = useTranslations("settings");
	const [enabled, setEnabled] = useState<string[]>(DEFAULT_ON);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) setEnabled(JSON.parse(raw));
		} catch { /* повреждённое значение — остаёмся на значениях по умолчанию */ }
	}, []);

	function toggle(item: Integration) {
		const on = !enabled.includes(item.id);
		const next = on ? [...enabled, item.id] : enabled.filter((id) => id !== item.id);
		setEnabled(next);
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
		toast(on ? t("intConnected", { name: t(item.key) }) : t("intDisconnected", { name: t(item.key) }));
	}

	return (
		<div className="p-16 md:p-30">
			<div className="flex flex-col gap-30 lg:flex-row">
				<SettingsTabs className="shrink-0 md:self-start" />
				<ul className="grid min-w-0 flex-1 grid-cols-2 gap-15 md:gap-20 lg:grid-cols-3 lg:gap-20">
					{INTEGRATIONS.map((item) => {
						const on = enabled.includes(item.id);
						const Icon = item.icon;
						return (
							<li key={item.id}>
								<button
									type="button"
									onClick={() => toggle(item)}
									aria-pressed={on}
									title={t("intDemo")}
									className="flex h-[125px] w-full flex-col items-center justify-center gap-10 rounded-8 bg-white px-8 shadow-heroImage transition-transform duration-200 hover:-translate-y-2 md:h-[125px]">
									<Icon size={42} className={`transition-colors duration-200 ${on ? "text-[#A5FFC9]" : "text-[#666666]"}`} />
									<span className={`text-center text-14 font-medium transition-colors duration-200 md:text-16 ${on ? "text-[#A5FFC9]" : "text-[#666666]"}`}>
										{t(item.key)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}
