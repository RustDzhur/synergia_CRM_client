"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { languages } from "@/app/languages/languages";
import { languageCodeToProperties } from "@/app/languages/languages";
import { Language } from "@/app/types/languageType";
import { useRouter } from "next/navigation";

export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { selectedLanguage, setSelectedLanguage } = useLanguageStore();
	const router = useRouter();
	const t = useTranslations("navBar");

	const availableLanguages = languages.filter(
		(flag) => flag.code !== selectedLanguage.code
	);

	useEffect(() => {
		const savedLanguage = localStorage.getItem('selectedLanguage');
	
		if (savedLanguage) {
		  const parsedLanguage = JSON.parse(savedLanguage);
		  setSelectedLanguage(parsedLanguage);
	
		  const currentPath = window.location.pathname;
		  currentPath.replace(/^\/[a-z]{2}/, `/${parsedLanguage.code}`);
	
		  const handleRouteChange = () => {
			const url = window.location.pathname;
			if (url.startsWith(`/${parsedLanguage.code}`)) {
			  router.replace(url);
			}
		  };
	
		  const handlePopState = () => {
			const url = window.location.pathname;
			if (url.startsWith(`/${parsedLanguage.code}`)) {
			  router.replace(url);
			}
		  };
	
		  // Подписываемся на события маршрута
		  window.addEventListener('popstate', handlePopState);
		  window.addEventListener('load', handleRouteChange);
	
		  return () => {
			// Отписываемся от событий при размонтировании компонента
			window.removeEventListener('popstate', handlePopState);
			window.removeEventListener('load', handleRouteChange);
		  };

		} else {
		  router.replace('/ua');
		}
	  }, [router, selectedLanguage.code, setSelectedLanguage]);

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

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
			<div onClick={handleOpenDropDown} className="mb-30 sm:p-20 md:p-0 ">
				<div className="flex items-center justify-between pl-12 pr-12 mb-24">
					<p>{t(`lang.${selectedLanguage.code}`)}</p>
					<div className="flex items-center">
						<Image
							src={selectedLanguageProperties.flagUrl}
							alt="selected-flag"
							width={selectedLanguageProperties.width}
							height={selectedLanguageProperties.height}
							className="w-40 cursor-pointer"
						/>
						<div>
							<IconContext.Provider value={{ size: "18px", color: "#999999" }}>
								{isOpenDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
							</IconContext.Provider>
						</div>
					</div>
				</div>

				{isOpenDropDown ? (
					<ul className="">
						{availableLanguages.map((lang, index) => (
							<li
								onClick={() => handleLanguageChange(lang)}
								key={uuidv4()}
								className={`${
									isOpenDropDown ? "lg:mt-6" : ""
								} cursor-pointer flex items-center justify-between ${
									index !== availableLanguages.length - 1 ? "mb-20" : ""
								}`}>
								<p>{t(`lang.${lang.code}`)}</p>
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
				) : null}
			</div>
		</div>
	);
}
