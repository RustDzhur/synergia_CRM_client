"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { FaFacebook, FaFacebookMessenger, FaTelegram, FaViber } from "react-icons/fa";
import { MdCall, MdSensors, MdSms, MdSmartToy, MdWidgets } from "react-icons/md";
import { useIntegrationsStore } from "@/app/store/useIntegrationsStore";
import type { IntegrationType } from "@/app/types/integrations";
import IntegrationDialog from "./integrations/IntegrationDialog";
import SettingsTabs from "./SettingsTabs";

interface Integration {
	id: string;
	key: string; // ключ перевода в settings
	icon: IconType;
	// настоящее подключение (Twilio, Telegram…); у карточек без него включатель остаётся демонстрационным
	real?: Exclude<IntegrationType, "mail">;
	alt?: Exclude<IntegrationType, "mail">; // второй возможный провайдер той же карточки: у «Call Provider» — SIP
}

// Порядок как на десктопе в Figma: три колонки по три карточки.
const INTEGRATIONS: Integration[] = [
	{ id: "call", key: "intCall", icon: MdCall, real: "twilio", alt: "sip" }, // звонки: Twilio или любой SIP-провайдер; SMS — только Twilio
	{ id: "sms", key: "intSms", icon: MdSms, real: "twilio" },
	{ id: "viber", key: "intViber", icon: FaViber, real: "viber" },
	{ id: "telegram", key: "intTelegram", icon: FaTelegram, real: "telegram" },
	{ id: "messenger", key: "intMessenger", icon: FaFacebookMessenger, real: "messenger" },
	{ id: "comments", key: "intComments", icon: FaFacebook },
	{ id: "chatbot", key: "intChatBot", icon: MdSmartToy },
	{ id: "onlinechat", key: "intOnlineChat", icon: MdSensors, real: "webchat" },
	{ id: "widget", key: "intWidget", icon: MdWidgets, real: "webchat" }, // код для сайта — в окне онлайн-чата
];

const STORAGE_KEY = "crm.integrations";

// Settings → Integration (/crm/settings/integration). Каналы с полем real подключаются по-настоящему (окно с реквизитами,
// сервер проверяет ключи и настраивает вебхуки); Comments и Chat Bot пока демонстрационные:
// нажатие включает/выключает карточку, состояние хранится в браузере (localStorage).
export default function IntegrationSettings() {
	const t = useTranslations("settings");
	const [enabled, setEnabled] = useState<string[]>([]);
	const [dialog, setDialog] = useState<Integration | null>(null);
	const { items, load } = useIntegrationsStore();
	useEffect(() => { load(); }, [load]);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) setEnabled(JSON.parse(raw));
		} catch { /* повреждённое значение — остаёмся на значениях по умолчанию */ }
	}, []);

	function press(item: Integration) {
		if (item.real) {
			// у «Call Provider» открываем ту вкладку, где провайдер уже подключён (иначе — Twilio)
			const sipOnly = item.alt && items.some((i) => i.type === item.alt && i.status === "connected") && !items.some((i) => i.type === item.real);
			return setDialog(sipOnly ? { ...item, real: item.alt } : item);
		}
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
						const linkedAll = item.real ? items.filter((i) => i.type === item.real || i.type === item.alt) : [];
						const on = item.real ? linkedAll.some((i) => i.status === "connected") : enabled.includes(item.id);
						const warn = !on && linkedAll.some((i) => i.status === "error");
						const color = warn ? "text-[#F4A100]" : on ? "text-[#A5FFC9]" : "text-[#666666]";
						const Icon = item.icon;
						return (
							<li key={item.id}>
								<button
									type="button"
									onClick={() => press(item)}
									aria-pressed={on}
									title={item.real ? undefined : t("intDemo")}
									className="flex h-[125px] w-full flex-col items-center justify-center gap-10 rounded-8 bg-white px-8 shadow-heroImage transition-transform duration-200 hover:-translate-y-2 md:h-[125px]">
									<Icon size={42} className={`transition-colors duration-200 ${color}`} />
									<span className={`text-center text-14 font-medium transition-colors duration-200 md:text-16 ${color}`}>
										{t(item.key)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
			<IntegrationDialog type={dialog?.real ?? null} title={dialog ? t(dialog.key) : ""} providerSwitch={dialog?.id === "call"} onClose={() => setDialog(null)} />
		</div>
	);
}
