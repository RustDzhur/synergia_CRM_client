"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { RiArrowDownSLine } from "react-icons/ri";
import Collapse from "@/app/utils/Collapse";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { languages, crmFlagUrl } from "@/app/languages/languages";
import { Language } from "@/app/types/languageType";
import { stripLocale } from "@/app/utils/locale";

// Строка «Language  🇬🇧 ⌄» из мобильного меню (Figma 375px).
export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { selectedLanguage, setSelectedLanguage } = useLanguageStore();
	const router = useRouter();
	const pathname = usePathname();
	const locale = useLocale();
	const t = useTranslations("navBar");

	const availableLanguages = languages.filter(
		(flag) => flag.code !== selectedLanguage.code
	);

	useEffect(() => {
		setSelectedLanguage({ code: locale });
	}, [locale, setSelectedLanguage]);

	const handleLanguageChange = (language: Language) => {
		setSelectedLanguage(language);
		setIsOpenDropDown(false);
		localStorage.setItem("selectedLanguage", JSON.stringify(language));
		// остаёмся на текущей странице, меняется только префикс языка
		router.replace(`/${language.code}${stripLocale(pathname)}`);
	};

	return (
		<div>
			<button
				type="button"
				onClick={() => setIsOpenDropDown(!isOpenDropDown)}
				className="flex items-center justify-between w-full h-[55px] px-12 cursor-pointer">
				<p className="text-18 font-medium text-iconColor">{t("language")}</p>
				<div className="flex items-center">
					<Image
						src={crmFlagUrl(selectedLanguage.code)}
						alt={t(`lang.${selectedLanguage.code}`)}
						width={37}
						height={25}
						className="w-[37px] h-[25px] object-cover"
					/>
					<RiArrowDownSLine
						size={24}
						color="#999999"
						className={`ml-4 transition-transform duration-200 ${isOpenDropDown ? "rotate-180" : ""}`}
					/>
				</div>
			</button>
			<Collapse open={isOpenDropDown}>
				<ul>
					{availableLanguages.map((lang) => (
						<li
							key={lang.code}
							onClick={() => handleLanguageChange(lang)}
							className="flex items-center justify-between h-[55px] px-12 cursor-pointer transition-colors duration-150 hover:bg-gray">
							<p className="text-18 font-medium text-iconColor">{t(`lang.${lang.code}`)}</p>
							<Image
								src={crmFlagUrl(lang.code)}
								alt={lang.code}
								width={37}
								height={25}
								className="w-[37px] h-[25px] object-cover"
							/>
						</li>
					))}
				</ul>
			</Collapse>
		</div>
	);
}
