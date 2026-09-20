"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { RiArrowDownSLine } from "react-icons/ri";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { languages } from "@/app/languages/languages";
import { languageCodeToProperties } from "@/app/languages/languages";
import { Language } from "@/app/types/languageType";
import { stripLocale } from "@/app/utils/locale";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { selectedLanguage, setSelectedLanguage } = useLanguageStore();
	const router = useRouter();
	const pathname = usePathname();
	const rootRef = useRef<HTMLDivElement>(null);

	const t = useTranslations("navBar");

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

	const locale = useLocale();
	useEffect(() => {
		setSelectedLanguage({ code: locale });
	}, [locale, setSelectedLanguage]);

	useClickOutside(rootRef, isOpenDropDown, () => setIsOpenDropDown(false));

	const handleLanguageChange = (language: Language) => {
		setSelectedLanguage(language);
		setIsOpenDropDown(false);
		localStorage.setItem("selectedLanguage", JSON.stringify(language));
		// остаёмся на той же странице сайта, меняется только язык
		router.replace(`/${language.code}${stripLocale(pathname) === "/" ? "" : stripLocale(pathname)}`);
	};

	const selectedLanguageProperties = languageCodeToProperties(
		selectedLanguage.code
	);

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-expanded={isOpenDropDown}
				onClick={handleOpenDropDown}
				className="flex items-center cursor-pointer">
				<Image
					src={selectedLanguageProperties.flagUrl}
					alt="selected-flag"
					width={selectedLanguageProperties.width}
					height={selectedLanguageProperties.height}
					className="w-40 rounded-4"
				/>
				<RiArrowDownSLine
					size={18}
					color="#999999"
					className={`transition-transform duration-200 ${isOpenDropDown ? "rotate-180" : ""}`}
				/>
			</button>

			<Dropdown open={isOpenDropDown} className="left-0 top-full mt-[12px]">
				<ul className="rounded-8 border border-[#E2F1F5] bg-white p-12 shadow-custom">
					{languages.map((lang, index) => (
						<li
							onClick={() => handleLanguageChange(lang)}
							key={lang.code}
							className={`cursor-pointer flex items-center justify-between ${
								index !== languages.length - 1 ? "mb-20" : ""
							}`}>
							<Image
								src={languageCodeToProperties(lang.code).flagUrl}
								alt={lang.code}
								width={languageCodeToProperties(lang.code).width}
								height={languageCodeToProperties(lang.code).height}
								className="w-40 mr-20 rounded-4"
							/>
							<p className="font-medium lg:text-18 text-menu whitespace-nowrap transition-colors duration-150 hover:text-activeMenu">
								{t(`lang.${lang.code}`)}
							</p>
						</li>
					))}
				</ul>
			</Dropdown>
		</div>
	);
}
