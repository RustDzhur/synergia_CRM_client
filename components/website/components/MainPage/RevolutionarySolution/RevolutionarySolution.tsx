"use client";
import React from "react";
import Link from "next/link";
import dock from "@/app/assets/images/dockPort.jpg";
import Logo from "@/components/crm/components/Header/components/Logo";
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
			<div className="bg-[#000000] opacity-[0.88] px-12 py-50 md:px-20 md:py-80 lg:px-350 flex flex-col items-center justify-center">
				<div className="mb-40">
					<Logo />
				</div>
				<p className="text-white font-bold text-24 md:text-40 leading-[1.7] tracking-[0.48px] md:tracking-[0.8px] text-center mb-40">
					{t("title")}
				</p>
				<Link
					className="bg-contactUs px-30 py-15 rounded-4 cursor-pointer text-18 font-medium text-white"
					href={
						selectedLanguage.code === "ua"
							? "/contacts"
							: `/${selectedLanguage.code}/contacts`
					}>
					{t("button")}
				</Link>
			</div>
		</div>
	);
}
