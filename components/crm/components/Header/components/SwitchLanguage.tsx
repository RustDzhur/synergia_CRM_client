"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { languages } from "@/app/languages/languages";
import { languageCodeToProperties } from "@/app/languages/languages";
import { Language } from "@/app/types/languageType";

export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { selectedLanguage, setSelectedLanguage } = useLanguageStore();
	const router = useRouter();
	const t = useTranslations("navBar");

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

	useEffect(() => {
		const savedLanguage = localStorage.getItem("selectedLanguage");
		if (!savedLanguage) {
			router.replace("/ua/crm")
		}
		if (savedLanguage) {
			setSelectedLanguage(JSON.parse(savedLanguage));
		}
	}, [router, setSelectedLanguage]);

	const handleLanguageChange = (language: Language) => {
		setSelectedLanguage(language);
		setIsOpenDropDown(false);
		localStorage.setItem("selectedLanguage", JSON.stringify(language));
		router.replace(`/${language.code}/crm`);
	};

	const selectedLanguageProperties = languageCodeToProperties(
		selectedLanguage.code
	);

	return (
		<div>
			<div onClick={handleOpenDropDown} className="relative">
				<div className="flex items-center">
					<Image
						src={selectedLanguageProperties.flagUrl}
						alt="selected-flag"
						width={selectedLanguageProperties.width}
						height={selectedLanguageProperties.height}
						className="w-40 cursor-pointer rounded-4"
					/>
					<div>
						<IconContext.Provider value={{ size: "18px", color: "#999999" }}>
							{isOpenDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
						</IconContext.Provider>
					</div>
				</div>

				{isOpenDropDown ? (
					<ul className={`absolute ${isOpenDropDown ? "mt-24" : ""}`}>
						{languages.map((lang) => (
							<li
								onClick={() => handleLanguageChange(lang)}
								key={uuidv4()}
								className="flex items-center mb-20">
								<Image
									src={languageCodeToProperties(lang.code).flagUrl}
									alt={lang.code}
									width={languageCodeToProperties(lang.code).width}
									height={languageCodeToProperties(lang.code).height}
									className="w-40 cursor-pointer mr-20 rounded-4"
								/>
								<p className="font-medium lg:text-18 text-menu hover:text-activeMenu">
									{t(`lang.${lang.code}`)}
								</p>
							</li>
						))}
					</ul>
				) : null}
			</div>
		</div>
	);
}
