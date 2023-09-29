"use client";
import React, { useState } from "react";
import { IconContext } from "react-icons";
import { AiFillCheckCircle } from "react-icons/ai";
import free from "@/app/assets/svgs/plans/free.svg";
import basic from "@/app/assets/svgs/plans/basic.svg";
import standart from "@/app/assets/svgs/plans/standart.svg";
import professional from "@/app/assets/svgs/plans/professional.svg";
import Image from "next/image";
import useAuthFormStore from "@/app/store/useAuthFormStore";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import { useTranslations } from "next-intl";

export default function PaidPlan() {
    const t = useTranslations ("paidPlan")
	const [active, setActive] = useState(t("month"));
	const { toggleSignUpForm } = useAuthFormStore();
	const { menu, toggleMenu } = useToggleMenuState();

	const handleToggleSignup = () => {
		toggleSignUpForm();
		if (!menu) {
			toggleMenu();
		}
	};
	const toggleActiveTab = (active: string) => {
		setActive(active);
	};

	const cardData = [
		{
			imageSrc: free,
			title: t("titleFree"),
			price: t("priceFree"),
			subTitle: t("subTitleFree"),
			features: [
				t("features.chat"),
				t("features.calls"),
				t("features.calendar"),
				t("features.workspace"),
				t("features.feed"),
				t("features.knowledge"),
			],
		},
		{
			imageSrc: basic,
			title: t("titleBasic"),
			price: `${active === t("month") ? "50" : 50 * 10}$/${
				active === t("month") ? t("month") : t("year")
			}`,
			subTitle: t("subTitleBasic"),
			features: [
				t("features.chat"),
				t("features.calls"),
				t("features.calendar"),
				t("features.workspace"),
				t("features.feed"),
				t("features.knowledge"),
			],
		},
		{
			imageSrc: standart,
			title: t("titleStandart"),
			price: `${active === t("month") ? "99" : 99 * 10}$/${
				active === t("month") ? t("month") : t("year")
			}`,
			subTitle: t("subTitleStandart"),
			features: [
				t("features.chat"),
				t("features.calls"),
				t("features.calendar"),
				t("features.workspace"),
				t("features.feed"),
				t("features.knowledge"),
			],
		},
		{
			imageSrc: professional,
			title: t("titleProfessional"),
            price: `${active === t("month") ? "150" : 150 * 10}$/${
				active === t("month") ? t("month") : t("year")
			}`,
			subTitle: t("subTitleProfessional"),
			features: [
				t("features.chat"),
				t("features.calls"),
				t("features.calendar"),
				t("features.workspace"),
				t("features.feed"),
				t("features.knowledge"),
			],
		},
	];

	return (
		<div>
			<h2 className="text-24 lg:text-36 font-bold text-center mb-30 lg:mb-60 text-textChoosePlan leading-[1.4] tracking-[0.48px]">
				{t("choosePlan")}
			</h2>
			<div className="flex justify-center mb-40">
				<div className="shadow-choosePlan rounded-50 inline-flex items-center justify-center ">
					<div
						className={`w-175 h-50 text-center flex items-center justify-center rounded-50 cursor-pointer ${
							active === t("month")
								? "bg-tabChoosePlan text-white"
								: "bg-white text-[#CCCCCC]"
						} font-bold text-18 `}
						onClick={() => toggleActiveTab(t("month"))}>
						{t("month")}
					</div>
					<div
						className={`w-175 h-50 text-center flex items-center justify-center rounded-50 cursor-pointer ${
							active === t("year")
								? "bg-tabChoosePlan text-white"
								: "bg-white text-[#CCCCCC]"
						} font-bold text-18 `}
						onClick={() => toggleActiveTab(t("year"))}>
						{t("year")}
					</div>
				</div>
			</div>
			<div className="overflow-x-scroll scroll-hide-scrollbar lg:overflow-x-initial flex lg:justify-between">
				{cardData.map((card, index) => (
					<div
						key={index}
						className={`p-25 shadow-choosePlan rounded-16 inline-flex flex-shrink-0 flex-col mb-8 mt-8 ml-8 ${
							index === cardData.length - 1 ? "mr-8" : "mr-20"
						} ${
							card.title === t("titleBasic") ? "bg-basicPlan" : "bg-white"
						} lg:m-0 lg:mt-2 lg:mb-2 ${
							card.title === t("titleFree") ? "lg:ml-2" : ""
						} ${card.title === t("titleProfessional") ? "lg:mr-2" : ""}`}>
						<div className="mb-40">
							<Image
								src={card.imageSrc}
								alt={card.title}
								width={50}
								className="mb-12"
							/>
							<p
								className={`text-20 text-textChoosePlan tracking-[0.4px] ${
									card.title === t("titleBasic") ? "text-white" : "text-textChoosePlan"
								}`}>
								{card.title}
							</p>
						</div>
						<div className="mb-40">
							<p
								className={`text-40 tracking-[0.8px] mb-6 ${
									card.title === t("titleBasic") ? "text-white" : "text-textChoosePlan"
								}`}>
								{card.title}
							</p>
							<p
								className={` text-16 tracking-[0.32px] ${
									card.title === t("titleBasic") ? "text-white" : "text-[#999999]"
								}`}>
								{card.price}
							</p>
							<p
								className={` text-16 tracking-[0.32px] ${
									card.title === t("titleBasic") ? "text-white" : "text-[#999999]"
								}`}>
								{card.subTitle}
							</p>
						</div>
						<div className="mb-40">
							<IconContext.Provider
								value={{
									size: "22px",
									color: `${card.title === t("titleBasic") ? "#fff" : "#313D45"}`,
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
													card.title === t("titleBasic")
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
							onClick={handleToggleSignup}
							className={`border-cardPlan rounded-8 text-center py-16 cursor-pointer hover:bg-tabChoosePlan  ${
								card.title === t("titleBasic") ? "text-white" : "text-tabChoosePlan"
							} hover:text-white tracking-[0.36px] font-bold`}>
							{t("button")}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
