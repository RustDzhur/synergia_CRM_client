"use client";
import { withLocale } from "@/app/utils/locale";
import React from "react";
import Link from "next/link";
import dock from "@/app/assets/images/dockPort.jpg";
import Logo from "../../Navigation/components/Logo";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { useTranslations } from "next-intl";

export default function RevolutionarySolution() {
	const backgroundImage = `url(${dock.src})`;
	const { selectedLanguage } = useLanguageStore();
	const t = useTranslations("revolutionalySalotions")
	return (
		<div
			className="bg-cover bg-no-repeat"
			style={{
				backgroundImage: `${backgroundImage}`,
				backgroundSize: "cover",
			}}>
			<div className="bg-[#000000] opacity-[0.88] px-12 py-50 md:px-20 md:py-80 lg:px-350 lg:pt-[75px] lg:pb-[78px] flex flex-col items-center justify-center">
				<div className="mb-40 lg:mb-[36px]">
					<Logo />
				</div>
				<p className="text-white font-semibold text-24 md:text-40 lg:text-50 leading-[1.7] lg:leading-[85px] tracking-[0.48px] md:tracking-[0.8px] lg:tracking-[1.3px] text-center mb-40 lg:mb-[39px]">
					{t("title")}
				</p>
				<Link
					className="bg-contactUs px-30 lg:px-[31px] py-15 lg:h-[54px] lg:flex lg:items-center lg:py-0 rounded-4 cursor-pointer text-18 font-medium lg:tracking-[0.4px] text-white shadow-custom"
					href={
						withLocale(selectedLanguage.code, "/contacts")
					}>
					{t("button")}
				</Link>
			</div>
		</div>
	);
}
