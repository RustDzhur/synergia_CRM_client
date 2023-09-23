"use client";
import React from "react";
import { MdDataExploration } from "react-icons/md";
import { VscSymbolInterface } from "react-icons/vsc";
import { AiFillApi } from "react-icons/ai";
import { IconContext } from "react-icons";

export default function JoinUs() {
	const contents = [
		{
			icon: MdDataExploration,
			title: "Comprehensive Data",
			text: "Showcase the CRM dashboard's ability to provide comprehensive data insights and analytics.",
		},
		{
			icon: VscSymbolInterface,
			title: "User-Friendly Interface",
			text: "Emphasize that the CRM dashboard offers an intuitive and user-friendly interface with highlight features",
		},
		{
			icon: AiFillApi,
			title: "Seamless Integration",
			text: "Highlight the CRM dashboard's capability to seamlessly integrate with other tools and platforms that the users might be using.",
		},
	];
	return (
		<div>
			<h1 className="text-center text-joinUsGrey sm:text-24 sm:mb-20 font-bold ">
				Why Join Us
			</h1>
			<div className="bg-joinUsPink sm:px-12 sm:py-30 md:p-20 lg:px-100 lg:py-50 text-white md:flex">
				{contents.map((content, index) => (
					<div key={index} className={`sm:mb-${index === contents.length - 1 ? '0' : '40'} md:mr-${index === contents.length - 1 ? '0' : '30'} md:mb-0`}>
						<div className="sm:w-50 sm:h-50 sm:mb-20 rounded-50 bg-white flex items-center justify-center m-auto">
								<IconContext.Provider
									value={{ size: "20px", color: "#FF008A" }}>
									<content.icon />
								</IconContext.Provider>
						</div>
						<h3 className="sm:text-25 md:text-20 font-bold md:font-medium text-center leading-[1.5] tracking-[0.5px] md:tracking-[0.4px]">{content.title}</h3>
						<p className="sm:text-16 md:text-14 font-medium leading-[1.7] tracking-[0.37px] md:tracking-[0.28px] sm:text-center">{content.text}</p>
					</div>
				))}
			</div>
		</div>
	);
}
