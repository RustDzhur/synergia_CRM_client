"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MdCheckCircle, MdErrorOutline, MdOpenInNew } from "react-icons/md";
import { apiCall } from "@/store/crmApi";
import { useIntegrationsStore } from "@/store/useIntegrationsStore";
import type { IntegrationDTO, IntegrationType, MailAccountDTO } from "@/types/integrations";
import IntegrationDialog from "../../Settings/integrations/IntegrationDialog";
import Modal from "../../shared/Modal";

type Connectable = Exclude<IntegrationType, "mail">;
type Needed = Connectable | "mail";

// Какими интеграциями обслуживается канал кампании: e-mail уходит через почтовые ящики из Web Mails,
// SMS и звонки — через Twilio (или SIP для звонков), мессенджеры — через своих ботов.
const NEEDED: Record<string, Needed[]> = {
	email_campaign: ["mail"],
	email: ["mail"],
	sms: ["twilio", "vonage", "plivo", "telnyx"],
	voice: ["twilio", "sip"],
	audio_call: ["twilio", "sip"],
	messengers: ["telegram", "viber", "whatsapp", "messenger", "webchat"],
};

// Названия провайдеров берём из Settings → Integration, чтобы одно и то же подключение называлось одинаково.
const LABEL: Record<Needed, string> = {
	mail: "intMailbox",
	twilio: "intSms",
	vonage: "intVonage",
	plivo: "intPlivo",
	telnyx: "intTelnyx",
	sip: "intProviderSip",
	telegram: "intTelegram",
	viber: "intViber",
	whatsapp: "intWhatsapp",
	messenger: "intMessenger",
	webchat: "intOnlineChat",
	// Доставка в кампаниях не участвует, но подпись нужна: тип интеграции общий (Settings → Integration)
	novaposhta: "intNovaPoshta",
	checkbox: "intCheckbox",
	prom: "intProm",
	rozetka: "intRozetka",
	horoshop: "intHoroshop",
	olx: "intOlx",
	ukrposhta: "intUkrposhta",
	monobank: "intMonobank",
	liqpay: "intLiqpay",
	wayforpay: "intWayforpay",
	cryptopay: "intCryptopay",
};

interface Props {
	card: { id: string; target: "campaigns" | "ads"; preset: Record<string, string> } | null; // выбранный канал
	onClose: () => void;
	onCreate: (target: "campaigns" | "ads", preset: Record<string, string>) => void;
}

// Окно канала: что уже подключено для этой рассылки и что нужно подключить. Само подключение открывается
// тем же окном реквизитов, что и в Settings → Integration, — ключи вводятся один раз и в одном месте.
export default function ChannelDialog({ card, onClose, onCreate }: Props) {
	const t = useTranslations("marketing");
	const ts = useTranslations("settings");
	const locale = useLocale();
	const { items, load } = useIntegrationsStore();
	const [accounts, setAccounts] = useState<MailAccountDTO[]>([]);
	const [dialog, setDialog] = useState<Connectable | null>(null);

	useEffect(() => { load(); }, [load]);
	useEffect(() => {
		if (!card) return;
		void apiCall<{ accounts: MailAccountDTO[] }>("/api/mail/accounts").then((r) => setAccounts(r.data?.accounts ?? []));
	}, [card]);

	if (!card) return null;
	const needed = NEEDED[card.id] ?? [];
	const connected = (type: Needed) =>
		type === "mail" ? accounts.filter((a) => a.status === "connected") : items.filter((i) => i.type === type && i.status === "connected");
	const broken = (type: Needed) => (type === "mail" ? accounts.filter((a) => a.status === "error") : items.filter((i) => i.type === type && i.status === "error"));
	const anyConnected = needed.some((type) => connected(type).length > 0);

	const status = (type: Needed) => {
		if (broken(type).length) return { text: t("chError"), cls: "text-[#EB5757]" };
		if (connected(type).length) return { text: t("chConnected"), cls: "text-[#2DDEB6]" };
		return { text: t("chNone"), cls: "text-[#B3B3B3]" };
	};
	// строка-пояснение: адрес ящика, номер Twilio или имя бота
	const detail = (i: IntegrationDTO) => [i.name, i.config?.email, i.config?.phone, i.config?.botName, i.config?.server].filter(Boolean).join(" · ");
	const lines = (type: Needed): string[] =>
		type === "mail" ? accounts.map((a) => `${a.email} · ${a.provider}`) : items.filter((i) => i.type === type).map(detail);

	return (
		<>
			<Modal open onClose={onClose} align="top" label={t(`card_${card.id}`)} className="w-full max-w-[560px]">
				<div className="max-h-[calc(100vh-32px)] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="text-20 font-medium text-black">{t(`card_${card.id}`)}</h2>
					<p className="mt-4 text-14 text-[#999999]">{t("chHint")}</p>

					<ul className="mt-16 flex flex-col gap-10">
						{needed.map((type) => {
							const st = status(type);
							const live = lines(type);
							return (
								<li key={type} className="rounded-8 border border-[#EFEFEF] p-12">
									<div className="flex items-center gap-10">
										<span className="flex-1 text-16 font-medium text-[#333333]">{ts(LABEL[type])}</span>
										<span className={`text-14 ${st.cls}`}>{st.text}</span>
										{st.text === t("chConnected") ? <MdCheckCircle size={18} className="text-[#2DDEB6]" aria-hidden /> : null}
										{st.text === t("chError") ? <MdErrorOutline size={18} className="text-[#EB5757]" aria-hidden /> : null}
									</div>
									{live.length > 0 && (
										<ul className="mt-6 flex flex-col gap-2">
											{live.map((line) => <li key={line} className="text-13 text-[#999999]">{line}</li>)}
										</ul>
									)}
									<div className="mt-8 flex flex-wrap items-center gap-12">
										{type === "mail" ? (
											<Link href={`/${locale}/crm/collaboration/web-mails`} className="flex items-center gap-4 text-14 text-primaryColor transition-opacity hover:opacity-80">
												<MdOpenInNew size={16} />{t("chMail")}
											</Link>
										) : (
											<button type="button" onClick={() => setDialog(type as Connectable)} className="text-14 text-primaryColor transition-opacity hover:opacity-80">
												{live.length ? t("chSetup") : ts("intConnect")}
											</button>
										)}
									</div>
								</li>
							);
						})}
					</ul>

					<div className="mt-20 flex flex-wrap items-center justify-between gap-12">
						<Link href={`/${locale}/crm/settings/integration`} className="text-14 text-[#999999] transition-colors hover:text-primaryColor">{t("chAll")}</Link>
						<div className="flex items-center gap-12">
							<button type="button" onClick={onClose} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{ts("intClose")}</button>
							<button
								type="button"
								onClick={() => onCreate(card.target, card.preset)}
								className={`h-[44px] rounded-8 px-24 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 ${anyConnected ? "bg-primaryColor" : "bg-[#B9D7F2]"}`}>
								{t("createCampaign")}
							</button>
						</div>
					</div>
					{!anyConnected && <p className="mt-8 text-right text-12 text-[#B3B3B3]">{t("chNoIntegration")}</p>}
				</div>
			</Modal>

			<IntegrationDialog type={dialog} title={dialog ? ts(LABEL[dialog]) : ""} onClose={() => setDialog(null)} />
		</>
	);
}
