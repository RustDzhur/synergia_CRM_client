"use client";
import React, { useEffect, useState } from "react";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import { useCompanyStore } from "@/app/store/useCompanyStore";
import { useLanguageStore } from "@/app/store/useLanguageStore";

interface Company {
	id: string;
	name: string;
}

type LanguageTranslations = {
	[languageCode: string]: {
		[translationKey: string]: string | string[];
	  };
};

const languageTranslations: LanguageTranslations = {
	"en-US": {
		us: ["Switch Company", "Company"],
	},
	"de-DE": {
		de: ["Firma wechseln", "Firma"],
	},
	"uk-UA": {
		ua:["Переключити Компанію", "Компанія"],
	},
};

export default function SwitchCompany() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { companies, selectedCompany, fetchCompanies, selectCompany } =
		useCompanyStore();
	const { selectedLanguage } = useLanguageStore();

	useEffect(() => {
		fetchCompanies();
	}, [fetchCompanies]);

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

	const changeCompanyName = (company: Company) => {
		selectCompany(company);
		setIsOpenDropDown(false);
	};

	const translations = languageTranslations[selectedLanguage.code];

	let switchCompanyTranslation = "";
	let companyNameTranslation = "";

	if (
		selectedLanguage.code === "en-US" &&
		translations.us &&
		Array.isArray(translations.us)
	) {
		switchCompanyTranslation = translations.us[0];
		companyNameTranslation = translations.us[1];
	}
	if (
		selectedLanguage.code === "de-DE" &&
		translations.de &&
		Array.isArray(translations.de)
	) {
		switchCompanyTranslation = translations.de[0];
		companyNameTranslation = translations.de[1];
	}
	if (
		selectedLanguage.code === "uk-UA" &&
		translations.ua &&
		Array.isArray(translations.ua)
	) {
		switchCompanyTranslation = translations.ua[0];
		companyNameTranslation = translations.ua[1];
	}
	
	return (
		<div className="lg:flex lg:relative">
			<div className="flex">
				<div
					onClick={handleOpenDropDown}
					className="border-t-switchCompany cursor-pointer border-b-switchCompany border-l-switchCompany rounded-l-8 shadow-custom py-15 px-20">
					<p className="font-medium text-16 leading-16 text-primaryColor">
						{switchCompanyTranslation}
					</p>
				</div>
				<div
					onClick={handleOpenDropDown}
					className="flex  items-center cursor-pointer border-t-switchCompany border-b-switchCompany border-r-switchCompany rounded-r-8 shadow-custom py-15 px-20">
					<p className="font-medium text-16 leading-16 text-black mr-60">
						{selectedCompany ? selectedCompany.name : companyNameTranslation}
					</p>
					<IconContext.Provider value={{ size: "18px" }}>
						{isOpenDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
					</IconContext.Provider>
				</div>
			</div>

			{isOpenDropDown && (
				<ul className="lg:absolute right-0 top-full w-full lg:bg-headerBackground border-b-switchCompany rounded-b-8">
					{companies.map((company) => (
						<li
							key={company.id}
							onClick={() => changeCompanyName(company)}
							className={` border-t-switchCompany py-15 px-20 cursor-pointer ${
								selectedCompany && selectedCompany.id === company.id
									? "bg-gray"
									: ""
							}`}>
							<p className="font-medium text-16 leading-16 text-black">
								{company.name}
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
