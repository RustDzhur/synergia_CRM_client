"use client";
import React, { useState } from "react";
import Image from "next/image";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import ukraine from "@/app/assets/svgs/ukraine-flag-icon.svg";
import usa from "@/app/assets/svgs/united-states-flag-icon.svg";
import germany from "@/app/assets/svgs/germany-flag-icon.svg";
import { useLanguageStore } from "@/app/store/useLanguageStore";

interface Language {
	id: string;
	name: string;
	code: string;
}

const flags: Language[] = [
	{
		id: "us",
		name: "United States",
		code: "en-US",
	},
	{
		id: "de",
		name: "Germany",
		code: "de-DE",
	},
	{
		id: "ua",
		name: "Ukraine",
		code: "uk-UA",
	},
];

const languageCodeToProperties = (
	code: string
): { flagUrl: string; width: number; height: number } => {
	if (code === "en-US") {
		return { flagUrl: usa, width: 40, height: 30 };
	} else if (code === "de-DE") {
		return { flagUrl: germany, width: 40, height: 30 };
	} else if (code === "uk-UA") {
		return { flagUrl: ukraine, width: 40, height: 30 };
	}
	// Default values if code doesn't match
	return { flagUrl: "", width: 0, height: 0 };
};

export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { selectedLanguage, setSelectedLanguage } = useLanguageStore();

	const availableLanguages = flags.filter(
		(flag) => flag.code !== selectedLanguage.code
	);

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

	const handleLanguageChange = (language: Language) => {
		setSelectedLanguage(language);
		setIsOpenDropDown(false);

		// TODO: Send a request to update the user's language in the database
		// You can use an API call here to update the user's language preference.
	};

	const selectedLanguageProperties = languageCodeToProperties(
		selectedLanguage.code
	);

	return (
		<div className="flex items-center">
			<div className="relative" onClick={handleOpenDropDown}>
				<Image
					src={selectedLanguageProperties.flagUrl}
					alt="selected-flag"
					width={selectedLanguageProperties.width}
					height={selectedLanguageProperties.height}
					className="w-40 cursor-pointer"
				/>
				{isOpenDropDown ? (
					<ul className="hidden lg:block lg:absolute lg:top-full">
						{availableLanguages.map((lang) => (
							<li
								onClick={() => handleLanguageChange(lang)}
								key={lang.id}
								className={`${isOpenDropDown ? "lg:mt-6" : ""} cursor-pointer`}>
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
			<div>
				<IconContext.Provider value={{ size: "18px", color: "#999999" }}>
					{isOpenDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
				</IconContext.Provider>
			</div>
		</div>
	);
}
