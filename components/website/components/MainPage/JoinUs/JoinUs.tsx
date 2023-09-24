"use client";
import React from "react";
import { MdDataExploration } from "react-icons/md";
import { VscSymbolInterface } from "react-icons/vsc";
import { AiFillApi } from "react-icons/ai";
import { IconContext } from "react-icons";
import { useTranslations } from "next-intl";

export default function JoinUs() {
    const t = useTranslations ('joinUs')
	const contents = [
		{
			icon: MdDataExploration,
			title: t("comprehensiveData.title"),
			text: t("comprehensiveData.text"),
		},
		{
			icon: VscSymbolInterface,
			title: t("interface.title"),
			text: t("interface.text"),
		},
		{
			icon: AiFillApi,
			title: t("integration.title"),
			text: t("integration.text"),
		},
	];
	return (
		<div>
			<h1 className="text-center text-joinUsGrey sm:text-24 sm:mb-20 font-bold ">
				{t("whyJoinUs")}
			</h1>
			<div className="bg-joinUsPink sm:px-12 sm:py-30 md:p-20 lg:px-100 lg:py-50 text-white md:flex lg:flex lg:justify-between space-x-30">
				{contents.map((content, index) => (
					<div
						key={index}
						className={`${
							index === contents.length - 1 ? "mb-0" : "mb-40"
						} md:w-1/3 lg:w-1/4 md:mb-0 md:mr-${
							index === contents.length - 1 ? "0" : "30"
						} flex flex-col justify-between`}>
						<div>
							<div className="sm:w-50 sm:h-50 sm:mb-20 rounded-50 bg-white flex items-center justify-center m-auto">
								<IconContext.Provider
									value={{ size: "20px", color: "#FF008A" }}>
									<content.icon />
								</IconContext.Provider>
							</div>
							<h3 className="sm:text-25 md:text-18 lg:text-25 font-bold md:font-medium text-center leading-[1.5] tracking-[0.5px] md:tracking-[0.4px] md:mb-30 lg:mb-0">
								{content.title}
							</h3>
						</div>

						<div className="flex-grow">
							<p className="sm:text-16 md:text-14 lg:text-16 font-medium leading-[1.7] tracking-[0.37px] md:tracking-[0.28px] sm:text-center">
								{content.text}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
