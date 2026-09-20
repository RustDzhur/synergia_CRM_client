"use client";
import React, { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { RiArrowDownSLine } from "react-icons/ri";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { languages } from "@/app/languages/languages";
import { languageCodeToProperties } from "@/app/languages/languages";
import { Language } from "@/app/types/languageType";
import { stripLocale } from "@/app/utils/locale";
import Collapse from "@/app/utils/Collapse";
import { usePathname, useRouter } from "next/navigation";

export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { selectedLanguage, setSelectedLanguage } = useLanguageStore();
	const router = useRouter();
	const pathname = usePathname();
	const t = useTranslations("navBar");

	const availableLanguages = languages.filter(
		(flag) => flag.code !== selectedLanguage.code
	);

	const locale = useLocale();
	useEffect(() => {
		setSelectedLanguage({ code: locale });
	}, [locale, setSelectedLanguage]);

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

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
		<div>
			<div onClick={handleOpenDropDown} className="sm:px-20">
				<div
					className={`flex items-center justify-between transition-[margin] duration-300 ${
						isOpenDropDown ? "mb-24" : ""
					}`}>
					<p
						className={`text-24 font-medium cursor-pointer transition-colors duration-200 ${
							isOpenDropDown ? "text-activeMenu active-link" : "text-menu"
						} `}>
						{t(`lang.${selectedLanguage.code}`)}
					</p>
					<div className="flex items-center">
						<Image
							src={selectedLanguageProperties.flagUrl}
							alt="selected-flag"
							width={selectedLanguageProperties.width}
							height={selectedLanguageProperties.height}
							className="w-40 cursor-pointer"
						/>
						<RiArrowDownSLine
							size={18}
							color="#999999"
							className={`transition-transform duration-200 ${isOpenDropDown ? "rotate-180" : ""}`}
						/>
					</div>
				</div>

				<Collapse open={isOpenDropDown}>
					<ul className="">
						{availableLanguages.map((lang, index) => (
							<li
								onClick={() => handleLanguageChange(lang)}
								key={lang.code}
								className={`lg:mt-6 cursor-pointer flex items-center justify-between ${
									index !== availableLanguages.length - 1 ? "mb-20" : ""
								}`}>
								<p className="text-24 text-menu font-medium transition-colors duration-150 hover:text-black">{t(`lang.${lang.code}`)}</p>
								<Image
									src={languageCodeToProperties(lang.code).flagUrl}
									alt={lang.code}
									width={languageCodeToProperties(lang.code).width}
									height={languageCodeToProperties(lang.code).height}
									className="w-40 cursor-pointer"
								/>
							</li>
						))}
					</ul>
				</Collapse>
			</div>
		</div>
	);
}
