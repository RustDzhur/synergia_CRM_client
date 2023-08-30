"use client";
import React, { useState } from "react";
import { useToggleMenuState } from "@/app/store/store";
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

const menuItems = [
	{ icon: BsFillHouseFill, text: "Dashboard" },
	{ icon: BsFillPeopleFill, text: "Collaboration" },
	{ icon: GiProgression, text: "Company" },
	{ icon: BsBarChartSteps, text: "CRM" },
	{ icon: BsCardChecklist, text: "Tasks and Projects" },
	{ icon: SiIcinga, text: "Inventory Management" },
	{ icon: BsFillHandbagFill, text: "Marketing" },
	{ icon: BsDiagram3, text: "Automation" },
	{ icon: BsRocketTakeoffFill, text: "Upgrade Your Plan" },
	{ icon: FiSettings, text: "Settings" },
];

export default function ModalMobNav() {
	const { mobileMenu } = useToggleMenuState();
	const [activeIndex, setActiveIndex] = useState(0);

	const handleItemClick = (index: number) => {
		setActiveIndex(index);
	};

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
