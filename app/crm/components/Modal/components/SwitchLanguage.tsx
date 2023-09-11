"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { languages } from "@/app/languages/languages";
import { languageCodeToProperties } from "@/app/languages/languages";
import { Language } from "@/app/types/languageType";

const languageTranslations: Record<string, Record<string, string>> = {
	"en-US": {
	  us: "English",
	  de: "Germany",
	  ua: "Ukrainian",
	},
	"de-DE": {
	  us: "Englisch",
	  de: "Deutsch",
	  ua: "Ukrainisch",
	},
	"uk-UA": {
	  us: "Англійська",
	  de: "Німецька",
	  ua: "Українська",
	},
  };

export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { selectedLanguage, setSelectedLanguage } = useLanguageStore();

	const availableLanguages = languages.filter(
		(flag) => flag.code !== selectedLanguage.code
	);

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

	const handleLanguageChange = (language: Language) => {
		setSelectedLanguage(language);
		setIsOpenDropDown(false);
		localStorage.setItem("language", language.id);
	};

	const selectedLanguageProperties = languageCodeToProperties(
		selectedLanguage.code
	);

	useEffect(() => {
		const savedLanguage = localStorage.getItem("language");
		if (savedLanguage) {
		  const language = languages.find((flag) => flag.id === savedLanguage);
		  if (language) {
			setSelectedLanguage(language);
		  }
		}
	  }, [setSelectedLanguage]);
	
	  const translations = languageTranslations[selectedLanguage.code];


	return (
		<div>
			<div onClick={handleOpenDropDown} className="mb-30 sm:p-20 md:p-0 ">
				<div className="flex items-center justify-between pl-12 pr-12 mb-24">
					<p>{translations[selectedLanguage.id]}</p>
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
								<p>{translations[lang.id]}</p>
								<Image
									src={languageCodeToProperties(lang.code).flagUrl}
									alt={lang.name}
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
