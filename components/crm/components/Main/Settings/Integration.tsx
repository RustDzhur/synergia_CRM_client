"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { FaFacebook, FaFacebookMessenger, FaTelegram, FaViber, FaWhatsapp } from "react-icons/fa";
import { TbCode, TbDeviceMobileMessage, TbHeadset, TbPhone, TbRobot } from "react-icons/tb";
import { SMS_PROVIDER_TYPES } from "@/config/smsProviders";
import { useIntegrationsStore } from "@/store/useIntegrationsStore";
import type { IntegrationType } from "@/types/integrations";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import IntegrationDialog from "./integrations/IntegrationDialog";
import SettingsTabs from "./SettingsTabs";

interface Integration {
	id: string;
	key: string; // ключ перевода в settings
	icon: IconType;
	// настоящее подключение (Twilio, Telegram…); у карточек без него включатель остаётся демонстрационным
	real?: Exclude<IntegrationType, "mail">;
	alt?: Exclude<IntegrationType, "mail">; // второй возможный провайдер той же карточки: у «Call Provider» — SIP
	// все подключения этой карточки: у SMS — Twilio, Vonage, Plivo и Telnyx
	providers?: string[];
	// карточка с выбором провайдера плитками: у звонков и у СМС
	providerKind?: "call" | "sms";
}

// Порядок как на десктопе в Figma: три колонки по три карточки.
const INTEGRATIONS: Integration[] = [
	{ id: "call", key: "intCall", icon: TbPhone, real: "twilio", alt: "sip", providerKind: "call" }, // звонки: Twilio или любой SIP-провайдер
	{ id: "sms", key: "intSms", icon: TbDeviceMobileMessage, real: "twilio", providers: SMS_PROVIDER_TYPES, providerKind: "sms" },
	{ id: "viber", key: "intViber", icon: FaViber, real: "viber" },
	{ id: "telegram", key: "intTelegram", icon: FaTelegram, real: "telegram" },
	{ id: "messenger", key: "intMessenger", icon: FaFacebookMessenger, real: "messenger" },
	{ id: "whatsapp", key: "intWhatsapp", icon: FaWhatsapp, real: "whatsapp" },
	{ id: "comments", key: "intComments", icon: FaFacebook },
	{ id: "chatbot", key: "intChatBot", icon: TbRobot },
	{ id: "onlinechat", key: "intOnlineChat", icon: TbHeadset, real: "webchat" },
	{ id: "widget", key: "intWidget", icon: TbCode, real: "webchat" }, // код для сайта — в окне онлайн-чата
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
	const params = useSearchParams();
	useEffect(() => { load(); }, [load]);

	// Возврат из окна Facebook: колбэк приводит сюда с ?messenger=connected|choose|error
	useEffect(() => {
		const status = params?.get("messenger") ?? params?.get("whatsapp");
		if (!status) return;
		const message = params?.get("message") ?? "";
		window.history.replaceState(null, "", window.location.pathname);
		if (status === "connected") toast.success(t("intFbReady"));
		else if (status === "choose") toast(t("intFbChoose"));
		else toast.error(message || t("intFailed"));
		load();
	}, [params, t, load]);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) setEnabled(JSON.parse(raw));
		} catch { /* повреждённое значение — остаёмся на значениях по умолчанию */ }
	}, []);

	function press(item: Integration) {
		if (item.real) {
			// у СМС открываем плитку подключённого провайдера — иначе человек видел бы выбор там, где уже всё выбрано
			if (item.providers) {
				const linked = items.find((i) => item.providers!.includes(i.type) && i.status === "connected");
				if (linked) return setDialog({ ...item, real: linked.type as Exclude<IntegrationType, "mail"> });
			}
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
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="flex flex-col gap-20 lg:flex-row">
				<SettingsTabs className="shrink-0 md:self-start" />
				<ul className="grid min-w-0 flex-1 grid-cols-2 gap-12 md:gap-16 lg:grid-cols-3 lg:gap-16">
					{INTEGRATIONS.map((item) => {
						const kinds = item.providers ?? [item.real, item.alt].filter(Boolean) as string[];
						const linkedAll = kinds.length ? items.filter((i) => kinds.includes(i.type)) : [];
						const on = item.real ? linkedAll.some((i) => i.status === "connected") : enabled.includes(item.id);
						const warn = !on && linkedAll.some((i) => i.status === "error");
						const color = warn ? "text-[#F4A100]" : on ? "text-[#c6ff4d]" : "text-[#9AA396]";
						const Icon = item.icon;
						return (
							<li key={item.id}>
								<button
									type="button"
									onClick={() => press(item)}
									aria-pressed={on}
									title={item.real ? undefined : t("intDemo")}
									className={`fs-card flex h-[112px] w-full flex-col items-center justify-center gap-10 px-8 transition-all duration-200 hover:-translate-y-2 ${on ? "border-[rgba(198,255,77,0.28)]" : "hover:border-[rgba(255,255,255,0.16)]"}`}>
									<Icon size={30} className={`transition-colors duration-200 ${color}`} />
									<span className={`text-center text-12 font-medium transition-colors duration-200 ${color}`}>
										{t(item.key)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
			<IntegrationDialog type={dialog?.real ?? null} title={dialog ? t(dialog.key) : ""} providerKind={dialog?.providerKind} onClose={() => setDialog(null)} />
		</div>
	);
}
