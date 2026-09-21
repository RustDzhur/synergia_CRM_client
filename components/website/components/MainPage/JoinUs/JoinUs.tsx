"use client";
import React from "react";
import { MdAreaChart, MdHiking } from "react-icons/md";
import { TbHexagons } from "react-icons/tb";
import { useTranslations } from "next-intl";

export default function JoinUs() {
    const t = useTranslations ('joinUs')
	const contents = [
		{
			icon: MdAreaChart,
			title: t("comprehensiveData.title"),
			text: t("comprehensiveData.text"),
		},
		{
			icon: MdHiking,
			title: t("interface.title"),
			text: t("interface.text"),
		},
		{
			icon: TbHexagons,
			title: t("integration.title"),
			text: t("integration.text"),
		},
	];
	return (
		<div>
			<h1 className="text-center text-joinUsGrey sm:text-24 lg:text-36 font-medium tracking-[0.48px] lg:tracking-[1px] sm:mb-20 lg:mb-[52px]">
				{t("whyJoinUs")}
			</h1>
			<div className="bg-joinUsPink sm:px-12 sm:py-30 md:px-20 md:py-30 lg:px-100 lg:pt-50 lg:pb-40 text-white md:grid md:grid-cols-3 md:gap-x-20 lg:gap-x-80 sm:space-y-40 md:space-y-0">
				{contents.map((content, index) => (
					<div key={index} className="flex flex-col items-center text-center">
						<div className="sm:w-50 sm:h-50 lg:w-[90px] lg:h-[90px] sm:mb-20 lg:mb-[20px] rounded-[50%] bg-[#F2F2F2] shadow-[0_4px_8px_rgba(0,0,0,0.15)] flex items-center justify-center text-[24px] lg:text-[44px] text-joinUsPink">
							<content.icon />
						</div>
						<h3 className="sm:text-[26px] md:text-[21px] lg:text-25 font-medium leading-[1.5] tracking-[0.3px] lg:mb-[4px]">
							{content.title}
						</h3>
						<p className="sm:text-16 md:text-14 lg:text-16 leading-[1.7] tracking-[0.4px] md:leading-[24px] lg:leading-[27px]">
							{content.text}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}
