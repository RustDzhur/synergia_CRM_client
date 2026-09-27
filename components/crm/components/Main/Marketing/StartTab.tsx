"use client";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import { FaFacebook, FaLinkedinIn, FaTwitter } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { TbDeviceMobileMessage, TbMail, TbMailForward, TbMessages, TbPhoneCall, TbWaveSine } from "react-icons/tb";
import type { CustomTabApi } from "../shared/records/RecordsPage";
import ChannelDialog from "./components/ChannelDialog";

interface Card {
	id: string; // ключ перевода: card_<id>
	target: "campaigns" | "ads"; // в какой вкладке создаётся запись
	preset: Record<string, string>;
	// круглый значок: цвет круга и белая иконка либо готовая иконка бренда
	circle?: { bg: string; icon: IconType };
	brand?: { icon: IconType; color?: string; size: number };
}

// Карточки каналов из макета: пять каналов рассылки, четыре рекламные площадки и «E-Mail».
// (В макете у площадок подписи скопированы с первого ряда — здесь у каждой своя.)
const CARDS: Card[] = [
	{ id: "email_campaign", target: "campaigns", preset: { channel: "email_campaign" }, circle: { bg: "#2DBEF0", icon: TbMailForward } },
	{ id: "sms", target: "campaigns", preset: { channel: "sms" }, circle: { bg: "#FF5A87", icon: TbDeviceMobileMessage } },
	{ id: "messengers", target: "campaigns", preset: { channel: "messengers" }, circle: { bg: "#8DC70A", icon: TbMessages } },
	{ id: "voice", target: "campaigns", preset: { channel: "voice" }, circle: { bg: "#2B96C8", icon: TbWaveSine } },
	{ id: "audio_call", target: "campaigns", preset: { channel: "audio_call" }, circle: { bg: "#14939F", icon: TbPhoneCall } },
	{ id: "facebook", target: "ads", preset: { platform: "facebook" }, brand: { icon: FaFacebook, color: "#1877F2", size: 70 } },
	{ id: "google", target: "ads", preset: { platform: "google" }, brand: { icon: FcGoogle, size: 70 } },
	{ id: "linkedin", target: "ads", preset: { platform: "linkedin" }, circle: { bg: "#1D6BA5", icon: FaLinkedinIn } },
	{ id: "twitter", target: "ads", preset: { platform: "twitter" }, brand: { icon: FaTwitter, color: "#1DA1F2", size: 56 } },
	{ id: "email", target: "campaigns", preset: { channel: "email" }, circle: { bg: "#D50FB3", icon: TbMail } },
];

// Вкладка Start: заголовок «Create Campaign» и карточки каналов. Нажатие на канал рассылки открывает окно
// с его интеграциями (e-mail кампании — почтовые ящики, SMS и звонки — Twilio, мессенджеры — боты) и кнопкой
// «Создать кампанию»; рекламные площадки по-прежнему сразу открывают окно новой рекламы.
export default function StartTab({ query, create }: CustomTabApi) {
	const t = useTranslations("marketing");
	const tr = useTranslations("records");
	const [channel, setChannel] = useState<Card | null>(null);
	const q = query.trim().toLowerCase();
	const cards = q ? CARDS.filter((c) => t(`card_${c.id}`).toLowerCase().includes(q)) : CARDS;

	return (
		<section>
			<h1 className="mb-16 text-15 font-semibold text-[#f1f4ee]">{t("createCampaign")}</h1>
			{cards.length === 0 ? (
				<p className="fs-card p-24 text-center text-13 text-[#8c948b]">{tr("nothingFound")}</p>
			) : (
				<ul className="grid grid-cols-2 gap-12 md:grid-cols-3 md:gap-16 lg:grid-cols-5">
					{cards.map((c) => {
						const Circle = c.circle?.icon;
						const Brand = c.brand?.icon;
						return (
							<li key={c.id}>
								<button
									type="button"
									onClick={() => (c.target === "campaigns" ? setChannel(c) : create(c.target, c.preset))}
									className="fs-card flex h-[108px] w-full flex-col items-center justify-center gap-10 px-8 transition-all duration-200 hover:-translate-y-2 hover:border-[rgba(198,255,77,0.35)]">
									<span className="flex h-[52px] w-[52px] items-center justify-center">
										{Circle && c.circle && (
											<span className="flex h-[52px] w-[52px] items-center justify-center rounded-50 text-white" style={{ background: c.circle.bg }}>
												<Circle size={26} />
											</span>
										)}
										{Brand && c.brand && <Brand size={Math.round(c.brand.size * 0.75)} color={c.brand.color} />}
									</span>
									<span className="text-center text-12 font-medium text-[#cfd4cb]">{t(`card_${c.id}`)}</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}

			<ChannelDialog card={channel} onClose={() => setChannel(null)} onCreate={(target, preset) => { setChannel(null); create(target, preset); }} />
		</section>
	);
}
