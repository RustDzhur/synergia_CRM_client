"use client";
import React, { useState } from "react";
import { IconContext } from "react-icons";
import { AiFillCheckCircle } from "react-icons/ai";
import free from "@/app/assets/svgs/plans/free.svg";
import basic from "@/app/assets/svgs/plans/basic.svg";
import standart from "@/app/assets/svgs/plans/standart.svg";
import professional from "@/app/assets/svgs/plans/professional.svg";
import Image from "next/image";

export default function PaidPlan() {
	const [active, setActive] = useState("Month");
	const toggleActiveTab = (active: string) => {
		setActive(active);
	};
	const cardData = [
		{
			imageSrc: free,
			title: "Free",
			subTitle: "Unlimited Users Trial 6 months",
			features: [
				"Chat",
				"HD Video Calls",
				"Calendar",
				"Company Workspace",
				"Feed",
				"Knowledge Base",
			],
		},
		{
			imageSrc: basic,
			title: "Basic",
			subTitle: "1990$/month",
			features: [
				"Chat",
				"HD Video Calls",
				"Calendar",
				"Company Workspace",
				"Feed",
				"Knowledge Base",
			],
		},
        {
			imageSrc: standart,
			title: "Standart",
			subTitle: "5990$/month",
			features: [
				"Chat",
				"HD Video Calls",
				"Calendar",
				"Company Workspace",
				"Feed",
				"Knowledge Base",
			],
		},
        {
			imageSrc: professional,
			title: "Professional",
			subTitle: "11990$/month",
			features: [
				"Chat",
				"HD Video Calls",
				"Calendar",
				"Company Workspace",
				"Feed",
				"Knowledge Base",
			],
		},
	];

	return (
		<div>
			<h2 className="text-24 lg:text-36 font-bold text-center mb-30 lg:mb-60 text-textChoosePlan leading-[1.4] tracking-[0.48px]">
				Choose Your Plan
			</h2>
			<div className="flex justify-center mb-40">
				<div className="shadow-choosePlan rounded-50 inline-flex items-center justify-center ">
					<div
						className={`w-175 h-50 text-center flex items-center justify-center rounded-50 cursor-pointer ${
							active === "Month"
								? "bg-tabChoosePlan text-white"
								: "bg-white text-[#CCCCCC]"
						} font-bold text-18 `}
						onClick={() => toggleActiveTab("Month")}>
						Month
					</div>
					<div
						className={`w-175 h-50 text-center flex items-center justify-center rounded-50 cursor-pointer ${
							active === "Year"
								? "bg-tabChoosePlan text-white"
								: "bg-white text-[#CCCCCC]"
						} font-bold text-18 `}
						onClick={() => toggleActiveTab("Year")}>
						Year
					</div>
				</div>
			</div>
			<div className="overflow-x-scroll scroll-mb-30 flex space-x-4">
				{cardData.map((card, index) => (
					<div
						key={index}
						className={`p-25 shadow-choosePlan rounded-16 inline-flex flex-shrink-0 flex-col mb-8 mt-8 ml-8 ${
							index === cardData.length - 1 ? "mr-8" : "mr-20"
						} ${card.title === "Basic" ? "bg-basicPlan" : "bg-white"}`}>
						<div className="mb-40">
							<Image
								src={card.imageSrc}
								alt={card.title}
								width={50}
								className="mb-12"
							/>
							<p
								className={`text-20 text-textChoosePlan tracking-[0.4px] ${
									card.title === "Basic" ? "text-white" : "text-textChoosePlan"
								}`}>
								{card.title}
							</p>
						</div>
						<div className="mb-40">
							<p
								className={`text-40 tracking-[0.8px] mb-6 ${
									card.title === "Basic" ? "text-white" : "text-textChoosePlan"
								}`}>
								{card.title}
							</p>
							<p
								className={` text-16 tracking-[0.32px] ${
									card.title === "Basic" ? "text-white" : "text-[#999999]"
								}`}>
								{card.subTitle}
							</p>
						</div>
						<div className="mb-40">
							<IconContext.Provider
								value={{
									size: "22px",
									color: `${card.title === "Basic" ? "#fff" : "#313D45"}`,
								}}>
								<ul className="text-18 font-medium tracking-[0.36px] space-y-4">
									{card.features.map((feature, featureIndex) => (
										<li
											key={featureIndex}
											className={`flex items-center ${
												featureIndex !== card.features.length - 1
													? "mb-18"
													: "mb-0"
											}`}>
											<AiFillCheckCircle className="mr-8" />
											<p
												className={`text-18 font-medium tracking-[0.36px] ${
													card.title === "Basic"
														? "text-white"
														: "text-textChoosePlan"
												}`}>
												{feature}
											</p>
										</li>
									))}
								</ul>
							</IconContext.Provider>
						</div>
						<div
							className={`border-cardPlan rounded-8 text-center py-16 cursor-pointer hover:bg-tabChoosePlan  ${
								card.title === "Basic" ? "text-white" : "text-tabChoosePlan"
							} hover:text-white tracking-[0.36px] font-bold`}>
							Choose Plan
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
