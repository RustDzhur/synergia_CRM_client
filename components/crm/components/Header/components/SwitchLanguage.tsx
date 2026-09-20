"use client";
import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { RiArrowDownSLine } from "react-icons/ri";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { languages, crmFlagUrl } from "@/app/languages/languages";
import { Language } from "@/app/types/languageType";
import { stripLocale } from "@/app/utils/locale";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";

// Флаг 25×18 и серая стрелка; список — флаги друг под другом в рамке (Figma: Header).
export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { selectedLanguage, setSelectedLanguage } = useLanguageStore();
	const router = useRouter();
	const pathname = usePathname();
	const locale = useLocale();
	const t = useTranslations("navBar");
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setSelectedLanguage({ code: locale });
	}, [locale, setSelectedLanguage]);

	useClickOutside(rootRef, isOpenDropDown, () => setIsOpenDropDown(false));

	const handleLanguageChange = (language: Language) => {
		setSelectedLanguage(language);
		setIsOpenDropDown(false);
		localStorage.setItem("selectedLanguage", JSON.stringify(language));
		// остаёмся на текущей странице, меняется только префикс языка
		router.replace(`/${language.code}${stripLocale(pathname)}`);
	};

	const otherLanguages = languages.filter((l) => l.code !== selectedLanguage.code);

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-label="Language"
				aria-expanded={isOpenDropDown}
				onClick={() => setIsOpenDropDown(!isOpenDropDown)}
				className="flex items-center cursor-pointer">
				<Image
					src={crmFlagUrl(selectedLanguage.code)}
					alt={t(`lang.${selectedLanguage.code}`)}
					width={25}
					height={18}
					className="w-25 h-[18px] rounded-4 object-cover"
				/>
				<RiArrowDownSLine
					size={24}
					color="#999999"
					className={`transition-transform duration-200 ${isOpenDropDown ? "rotate-180" : ""}`}
				/>
			</button>
			<Dropdown open={isOpenDropDown} className="left-[-8px] top-full mt-[8px]">
				<ul className="flex flex-col gap-4 rounded-8 border border-[#E2F1F5] bg-white p-8 shadow-custom">
					{otherLanguages.map((lang) => (
						<li key={lang.code}>
							<button
								type="button"
								aria-label={t(`lang.${lang.code}`)}
								onClick={() => handleLanguageChange(lang)}
								className="flex rounded-4 p-2 transition-opacity duration-150 hover:opacity-70">
								<Image
									src={crmFlagUrl(lang.code)}
									alt=""
									width={25}
									height={18}
									className="w-25 h-[18px] rounded-4 object-cover"
								/>
							</button>
						</li>
					))}
				</ul>
			</Dropdown>
		</div>
	);
}
