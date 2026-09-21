"use client";
import React from "react";
import { useTranslations } from "next-intl";
import type { IconType } from "react-icons";
import { FaFacebook, FaLinkedinIn, FaTwitter } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { MdCall, MdChat, MdEmail, MdForwardToInbox, MdGraphicEq, MdSms } from "react-icons/md";
import type { CustomTabApi } from "../shared/records/RecordsPage";

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
	{ id: "email_campaign", target: "campaigns", preset: { channel: "email_campaign" }, circle: { bg: "#2DBEF0", icon: MdForwardToInbox } },
	{ id: "sms", target: "campaigns", preset: { channel: "sms" }, circle: { bg: "#FF5A87", icon: MdSms } },
	{ id: "messengers", target: "campaigns", preset: { channel: "messengers" }, circle: { bg: "#8DC70A", icon: MdChat } },
	{ id: "voice", target: "campaigns", preset: { channel: "voice" }, circle: { bg: "#2B96C8", icon: MdGraphicEq } },
	{ id: "audio_call", target: "campaigns", preset: { channel: "audio_call" }, circle: { bg: "#14939F", icon: MdCall } },
	{ id: "facebook", target: "ads", preset: { platform: "facebook" }, brand: { icon: FaFacebook, color: "#1877F2", size: 70 } },
	{ id: "google", target: "ads", preset: { platform: "google" }, brand: { icon: FcGoogle, size: 70 } },
	{ id: "linkedin", target: "ads", preset: { platform: "linkedin" }, circle: { bg: "#1D6BA5", icon: FaLinkedinIn } },
	{ id: "twitter", target: "ads", preset: { platform: "twitter" }, brand: { icon: FaTwitter, color: "#1DA1F2", size: 56 } },
	{ id: "email", target: "campaigns", preset: { channel: "email" }, circle: { bg: "#D50FB3", icon: MdEmail } },
];

// Вкладка Start: заголовок «Create Campaign» и карточки каналов. Нажатие открывает окно новой записи
// (кампания или реклама) с уже выбранным каналом; после сохранения страница переключается на нужную вкладку.
export default function StartTab({ query, create }: CustomTabApi) {
	const t = useTranslations("marketing");
	const tr = useTranslations("records");
	const q = query.trim().toLowerCase();
	const cards = q ? CARDS.filter((c) => t(`card_${c.id}`).toLowerCase().includes(q)) : CARDS;

	return (
		<section>
			<h1 className="mb-20 text-24 font-normal text-[#666666] lg:mb-30 lg:text-32">{t("createCampaign")}</h1>
			{cards.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{tr("nothingFound")}</p>
			) : (
				<ul className="grid grid-cols-2 gap-15 md:grid-cols-3 md:gap-20 lg:grid-cols-5">
					{cards.map((c) => {
						const Circle = c.circle?.icon;
						const Brand = c.brand?.icon;
						return (
							<li key={c.id}>
								<button
									type="button"
									onClick={() => create(c.target, c.preset)}
									className="flex h-[123px] w-full flex-col items-center justify-center gap-12 rounded-8 bg-white px-8 shadow-heroImage transition-transform duration-200 hover:-translate-y-2 lg:h-[126px]">
									<span className="flex h-[70px] w-[70px] items-center justify-center">
										{Circle && c.circle && (
											<span className="flex h-[70px] w-[70px] items-center justify-center rounded-50 text-white" style={{ background: c.circle.bg }}>
												<Circle size={34} />
											</span>
										)}
										{Brand && c.brand && <Brand size={c.brand.size} color={c.brand.color} />}
									</span>
									<span className="text-center text-14 font-medium text-[#999999] md:text-16 lg:text-18">{t(`card_${c.id}`)}</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
