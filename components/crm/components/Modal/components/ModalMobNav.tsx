"use client";
import React, { useState } from "react";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import {useTranslations} from 'next-intl';
import {
	BsFillHouseFill,
	BsFillPeopleFill,
	BsBarChartSteps,
	BsCardChecklist,
	BsFillHandbagFill,
	BsDiagram3,
	BsRocketTakeoffFill,
} from "react-icons/bs";
import { GiProgression } from "react-icons/gi";
import { SiIcinga } from "react-icons/si";
import { FiSettings } from "react-icons/fi";
import { IconContext } from "react-icons";

export default function ModalMobNav() {
	const { mobileMenu } = useToggleMenuState();
	const [activeIndex, setActiveIndex] = useState(0);

	const handleItemClick = (index: number) => {
		setActiveIndex(index);
	};

	const t = useTranslations('navigation')

	const menuItems = [
		{ icon: BsFillHouseFill, text: t("dashboard") },
		{ icon: BsFillPeopleFill, text: t("collaboration") },
		{ icon: GiProgression, text: t("company") },
		{ icon: BsBarChartSteps, text: t("crm") },
		{ icon: BsCardChecklist, text: t("tasks_projects") },
		{ icon: SiIcinga, text: t("inventory_management") },
		{ icon: BsFillHandbagFill, text: t("marketing") },
		{ icon: BsDiagram3, text: t("automation") },
		{ icon: BsRocketTakeoffFill, text: t("upgrade_plan") },
		{ icon: FiSettings, text: t("settings") },
	];

	return (
		<div
			className={`${
				!mobileMenu && "flex-col items-left inline-block"
			}  bg-secondaryColor  sm:w-[100vw] md:w-auto inline-block`}>
			<IconContext.Provider value={{ color: "#B3B3B3" }}>
				<ul>
					{menuItems.map((item, index) => (
						<li
							key={index}
							onClick={() => handleItemClick(index)}
							className={`p-16 ${
								activeIndex === index ? "bg-primaryColor" : ""
							} flex items-center cursor-pointer`}>
							<item.icon
								style={{
									color: activeIndex === index ? "white" : "#B3B3B3",
									marginRight: mobileMenu ? "10px" : "",
									width: "20px",
									height: "27px",
								}}
							/>

							{mobileMenu && (
								<p
									className={`text-14 mp:text-18 ${
										activeIndex === index ? "text-white" : "text-iconColor"
									} font-medium `}>
									{item.text}
								</p>
							)}
						</li>
					))}
				</ul>
			</IconContext.Provider>
		</div>
	);
}
