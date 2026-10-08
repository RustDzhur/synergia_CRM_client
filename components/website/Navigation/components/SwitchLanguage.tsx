"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { RiArrowDownSLine } from "react-icons/ri";
import { useLanguageStore } from "@/store/useLanguageStore";
import { siteLanguages as languages } from "@/languages/languages";
import { languageCodeToProperties } from "@/languages/languages";
import { Language } from "@/types/languageType";
import { stripLocale } from "@/utils/locale";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
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
				className="flex items-center gap-4 cursor-pointer">
				<Image
					src={selectedLanguageProperties.flagUrl}
					alt="selected-flag"
					width={selectedLanguageProperties.width}
					height={selectedLanguageProperties.height}
					className="h-[16px] w-[22px] rounded-4 object-cover"
				/>
				{/* подпись языка есть только на десктопе (Figma: флаг · English · шеврон) */}
				<span className="hidden lg:block ml-6 text-14 font-medium text-[#E6E6E6]">
					{t(`lang.${selectedLanguage.code}`)}
				</span>
				<RiArrowDownSLine
					size={16}
					color="#8c948b"
					className={`transition-transform duration-200 ${isOpenDropDown ? "rotate-180" : ""}`}
				/>
			</button>

			<Dropdown open={isOpenDropDown} className="left-[-8px] top-full mt-[8px]">
				<ul className="rounded-8 border border-[rgba(255,255,255,0.11)] bg-[#1D2320] p-10 shadow-custom">
					{languages.map((lang, index) => (
						<li
							onClick={() => handleLanguageChange(lang)}
							key={lang.code}
							className={`cursor-pointer flex items-center justify-between ${
								index !== languages.length - 1 ? "mb-12" : ""
							}`}>
							<Image
								src={languageCodeToProperties(lang.code).flagUrl}
								alt={lang.code}
								width={languageCodeToProperties(lang.code).width}
								height={languageCodeToProperties(lang.code).height}
								className="h-[16px] w-[22px] mr-12 rounded-4 object-cover"
							/>
							<p className="text-14 font-medium text-[#f1f4ee] whitespace-nowrap transition-colors duration-150 hover:text-[#c6ff4d]">
								{t(`lang.${lang.code}`)}
							</p>
						</li>
					))}
				</ul>
			</Dropdown>
		</div>
	);
}
