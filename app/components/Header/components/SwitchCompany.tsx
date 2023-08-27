"use client";
import React, { useState } from "react";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";

export default function SwitchCompany() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const [companyName, setCompanyName] = useState("Company");
	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};
	const changeCompanyName = (name: string) => {
		setCompanyName(name);
	};
	return (
		<div className="flex ">
			<div
				onClick={handleOpenDropDown}
				className="border-t-switchCompany cursor-pointer border-b-switchCompany border-l-switchCompany rounded-l-8 shadow-custom py-15 px-20">
				<p className="font-medium text-16 leading-16 text-primaryColor">
					Switch Company
				</p>
			</div>
			<div
				onClick={handleOpenDropDown}
				className="flex relative items-center cursor-pointer border-t-switchCompany border-b-switchCompany border-r-switchCompany rounded-r-8 shadow-custom py-15 px-20">
				<p className="font-medium text-16 leading-16 text-black mr-60">
					{companyName}
				</p>
				<IconContext.Provider value={{ size: "18px" }}>
					{isOpenDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
				</IconContext.Provider>
				{isOpenDropDown && (
					<ul className="absolute right-0 top-full w-full bg-headerBackground border-b-switchCompany rounded-b-8">
						<li
							onClick={() => changeCompanyName("Oliver Miller")}
							className={`border-r-switchCompany border-l-switchCompany border-t-switchCompany py-15 px-20 cursor-pointer ${
								companyName === "Oliver Miller" ? "bg-gray" : ""
							}`}>
							<p className="font-medium text-16 leading-16 text-black">
								Oliver Miller
							</p>
						</li>
						<li
							onClick={() => changeCompanyName("Volkswagen")}
							className={`border-r-switchCompany border-l-switchCompany border-t-switchCompany py-15 px-20 cursor-pointer ${
								companyName === "Volkswagen" ? "bg-gray" : ""
							}`}>
							<p className="font-medium text-16 leading-16 text-black">
								Volkswagen
							</p>
						</li>
						<li
							onClick={() => changeCompanyName("BMW")}
							className={`border-r-switchCompany border-l-switchCompany border-t-switchCompany py-15 px-20 cursor-pointer ${
								companyName === "BMW" ? "bg-gray" : ""
							}`}>
							<p className="font-medium text-16 leading-16 text-black">BMW</p>
						</li>
					</ul>
				)}
			</div>
		</div>
	);
}
