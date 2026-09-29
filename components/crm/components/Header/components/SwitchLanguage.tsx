"use client";
import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { TbChevronDown } from "react-icons/tb";
import { useLanguageStore } from "@/store/useLanguageStore";
import { languages, crmFlagUrl } from "@/languages/languages";
import { Language } from "@/types/languageType";
import { stripLocale } from "@/utils/locale";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";

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
				className="flex items-center gap-2 cursor-pointer">
				<Image
					src={crmFlagUrl(selectedLanguage.code)}
					alt={t(`lang.${selectedLanguage.code}`)}
					width={22}
					height={16}
					className="w-22 h-16 rounded-4 object-cover"
				/>
				<TbChevronDown
					size={15}
					className={`text-[#8c948b] transition-transform duration-200 ${isOpenDropDown ? "rotate-180" : ""}`}
				/>
			</button>
			<Dropdown open={isOpenDropDown} className="left-[-8px] top-full mt-[8px]">
				<ul className="fs-popover flex flex-col gap-4 p-8">
					{otherLanguages.map((lang) => (
						<li key={lang.code}>
							<button
								type="button"
								aria-label={t(`lang.${lang.code}`)}
								onClick={() => handleLanguageChange(lang)}
								className="flex rounded-4 p-2 transition-opacity duration-150 hover:opacity-60">
								<Image
									src={crmFlagUrl(lang.code)}
									alt=""
									width={22}
									height={16}
									className="w-22 h-16 rounded-4 object-cover"
								/>
							</button>
						</li>
					))}
				</ul>
			</Dropdown>
		</div>
	);
}
