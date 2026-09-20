"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RiArrowDownSLine } from "react-icons/ri";
import { useCompanyStore } from "@/app/store/useCompanyStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";

interface Company {
	id: string;
	name: string;
}

// Ширину задаёт родитель: 387px в шапке (desktop), на всю ширину в мобильном меню.
// Список компаний выпадает ровно под правой ячейкой (имя компании) — как в Figma.
export default function SwitchCompany() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const { companies, selectedCompany, fetchCompanies, selectCompany } =
		useCompanyStore();
	const t = useTranslations("navBar");
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		fetchCompanies();
	}, [fetchCompanies]);

	useClickOutside(rootRef, isOpenDropDown, () => setIsOpenDropDown(false));

	const changeCompanyName = (company: Company) => {
		selectCompany(company);
		setIsOpenDropDown(false);
	};

	return (
		<div ref={rootRef} className="flex w-full">
			<button
				type="button"
				onClick={() => setIsOpenDropDown(!isOpenDropDown)}
				className="shrink-0 h-50 px-20 cursor-pointer border-t-switchCompany border-b-switchCompany border-l-switchCompany rounded-l-8 shadow-custom">
				<p className="font-medium text-16 text-primaryColor whitespace-nowrap">
					{t("switch")}
				</p>
			</button>
			<div className="relative flex-1 min-w-0">
				<button
					type="button"
					aria-expanded={isOpenDropDown}
					onClick={() => setIsOpenDropDown(!isOpenDropDown)}
					className="flex items-center justify-between w-full h-50 px-20 cursor-pointer border-t-switchCompany border-b-switchCompany border-r-switchCompany rounded-r-8 shadow-custom">
					<p className="font-medium text-16 text-black truncate">
						{selectedCompany ? selectedCompany.name : t("company")}
					</p>
					<RiArrowDownSLine
						size={24}
						color="#4D4D4D"
						className={`ml-10 shrink-0 transition-transform duration-200 ${
							isOpenDropDown ? "rotate-180" : ""
						}`}
					/>
				</button>
				<Dropdown
					open={isOpenDropDown && companies.length > 0}
					className="left-0 right-0 top-full">
					<ul className="overflow-hidden rounded-b-8 border border-[#E2F1F5] border-t-0 bg-headerBackground shadow-custom">
						{companies.map((company) => (
							<li
								key={company.id}
								onClick={() => changeCompanyName(company)}
								className={`flex items-center h-50 px-20 cursor-pointer border-t border-[#E2F1F5] transition-colors duration-150 hover:bg-gray ${
									selectedCompany && selectedCompany.id === company.id
										? "bg-gray"
										: ""
								}`}>
								<p className="font-medium text-16 text-black">{company.name}</p>
							</li>
						))}
					</ul>
				</Dropdown>
			</div>
		</div>
	);
}
