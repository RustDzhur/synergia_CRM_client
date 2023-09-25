"use client";
import React from "react";
import Image from "next/image";
import Slider from "react-slick";
import { IconContext } from "react-icons";
import { AiFillCheckCircle } from "react-icons/ai";

import calendar from "@/public/images/slider/calendar.jpg";
import crm from "@/public/images/slider/crm.jpg";
import dashboard from "@/public/images/slider/dashboard.jpg";
import editCompany from "@/public/images/slider/editCompany.jpg";
import feed from "@/public/images/slider/feed.jpg";
import mailbox from "@/public/images/slider/mailbox.jpg";
import marketing from "@/public/images/slider/marketing.jpg";
import onlineDocuments from "@/public/images/slider/onlineDocuments.jpg";
import settingsAccount from "@/public/images/slider/settingsAccount.jpg";
import settingsIntegration from "@/public/images/slider/settingsIntegrations.jpg";
import { useTranslations } from "next-intl";

const settings = {
	dots: true,
	infinite: true,
	speed: 500,
	slidesToShow: 1,
	slidesToScroll: 1,
	autoplay: true,
	autoplaySpeed: 3000,
	fade: true,
};

export default function DiscoverCrm() {
	const t = useTranslations("discoverCrm");
	const lists = [
		{ icon: AiFillCheckCircle, text: t("comprehensive") },
		{ icon: AiFillCheckCircle, text: t("efficiency") },
		{ icon: AiFillCheckCircle, text: t("insights") },
		{ icon: AiFillCheckCircle, text: t("integration") },
	];
	const gallery = [
		{ original: calendar },
		{ original: crm },
		{ original: dashboard },
		{ original: editCompany },
		{ original: feed },
		{ original: mailbox },
		{ original: marketing },
		{ original: onlineDocuments },
		{ original: settingsAccount },
		{ original: settingsIntegration },
	];
	return (
		<div className="text-discover">
			<h2 className="text-24 lg:text-36 font-bold leading-[1.4] tracking-[0.48px] lg:tracking-[0.72px] text-center mb-30">
				{t("title")}
			</h2>
			<div className="lg:flex lg:justify-between">
				<div className="lg:w-505">
					<p className="text-16 md:text-18 leading-[1.7] tracking-[0.32px] sm:tracking-[0.36px] text-center md:text-left mb-40">
						{t("description")}
					</p>
					<div className="sm:mb-50">
						{lists.map((item, index) => (
							<div
								key={index}
								className={`flex items-center ${
									index === lists.length - 1 ? "" : "mb-12"
								}`}>
								<div className="sm:mr-8">
									<IconContext.Provider
										value={{ size: "30", color: "#313D45" }}>
										<item.icon />
									</IconContext.Provider>
								</div>
								<p className="text-18 leading-[1.7] tracking-[0.36px] font-bold">
									{item.text}
								</p>
							</div>
						))}
					</div>
				</div>

				<div className="md:w-525 md:mx-auto lg:m-0">
					<Slider {...settings}>
						{gallery.map((item, index) => (
							<div key={index}>
								<Image src={item.original} alt={`Image ${index}`} />
							</div>
						))}
					</Slider>
				</div>
			</div>
		</div>
	);
}
