"use client";
import React, { useState } from "react";
import { AiFillCheckCircle } from "react-icons/ai";
import free from "@/app/assets/svgs/plans/free.svg";
import standart from "@/app/assets/svgs/plans/standart.svg";
import professional from "@/app/assets/svgs/plans/professional.svg";
import Image from "next/image";
import useAuthFormStore from "@/app/store/useAuthFormStore";
import { useSiteMenuState } from "@/app/store/useSiteMenuState";
import { useTranslations } from "next-intl";
import { FEATURE_KEYS, PLANS, PlanId, YEAR_MONTHS } from "@/app/config/plans";

const ICONS: Record<PlanId, string> = { free, standard: standart, professional };

// Тарифы (app/config/plans.ts): на десктопе три карточки в ряд, на планшете и телефоне — лента с горизонтальной прокруткой.
// Средняя (Standard) — тёмная. Год = 10 месяцев цены за месяц.
export default function PaidPlan() {
    const t = useTranslations ("paidPlan")
	const [active, setActive] = useState(t("month"));
	const { toggleSignUpForm } = useAuthFormStore();
	const { menu, toggleMenu } = useSiteMenuState();
	const yearly = active === t("year");

	const handleToggleSignup = () => {
		toggleSignUpForm();
		if (!menu) {
			toggleMenu();
		}
	};

	const titles: Record<PlanId, string> = { free: t("titleFree"), standard: t("titleStandart"), professional: t("titleProfessional") };
	const subTitles: Record<PlanId, string> = { free: t("subTitleFree"), standard: t("subTitleStandart"), professional: t("subTitleProfessional") };

	const tab = (label: string) => (
		<div
			className={`sm:flex-1 md:flex-none md:w-[150px] h-[55px] text-center flex items-center justify-center rounded-50 cursor-pointer transition-colors duration-300 ${
				active === label ? "bg-tabChoosePlan text-white" : "bg-white text-[#CCCCCC]"
			} font-medium text-20 tracking-[0.4px]`}
			onClick={() => setActive(label)}>
			{label}
		</div>
	);

	return (
		<div>
			<h2 className="text-24 lg:text-36 font-medium text-center sm:mb-[29px] md:mb-30 lg:mb-[59px] text-textChoosePlan leading-[1.4] tracking-[0.48px] lg:tracking-[1px]">
				{t("choosePlan")}
			</h2>
			<div className="flex justify-center md:mb-[32px] lg:mb-[39px] sm:mb-[32px]">
				<div className="shadow-choosePlan rounded-50 flex w-full md:w-auto items-center justify-center">
					{tab(t("month"))}
					{tab(t("year"))}
				</div>
			</div>
			<div className="overflow-x-auto scroll-hide-scrollbar flex gap-20 sm:-mx-12 sm:px-12 md:-mx-20 md:px-20 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:gap-x-[40px] lg:overflow-x-visible py-8 lg:py-0">
				{PLANS.map((plan) => {
					const dark = !!plan.highlighted;
					const price = yearly ? plan.priceMonth * YEAR_MONTHS : plan.priceMonth;
					return (
						<div
							key={plan.id}
							className={`w-[295px] shrink-0 lg:w-auto p-25 rounded-16 flex flex-col ${
								dark ? "bg-basicPlan shadow-[0_4px_10px_rgba(0,0,0,0.25)]" : "bg-[#FDFDFD] shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
							}`}>
							<Image src={ICONS[plan.id]} alt={titles[plan.id]} width={50} className="mb-8" />
							<p className={`text-20 font-medium leading-[28px] tracking-[0.4px] mb-[39px] ${dark ? "text-white" : "text-textChoosePlan"}`}>
								{titles[plan.id]}
							</p>
							<p className={`text-40 font-medium leading-[48px] tracking-[0.8px] ${dark ? "text-white" : "text-[#666666]"}`}>
								{plan.priceMonth === 0 ? (
									titles.free
								) : (
									<>
										{price}€
										<span className="text-20 font-normal tracking-[0.4px]">/{yearly ? t("year") : t("month")}</span>
									</>
								)}
							</p>
							<p className={`text-16 leading-[24px] tracking-[0.4px] ${dark ? "text-white" : "text-[#B3B3B3]"}`}>
								{subTitles[plan.id]}
							</p>
							<p className={`text-14 leading-[20px] tracking-[0.4px] mb-[35px] ${dark ? "text-[#C7CDD1]" : "text-[#B3B3B3]"}`}>
								{t("limitsLine", { rules: plan.automationRules, ai: plan.aiDailyRequests, storage: plan.storageMb >= 1000 ? `${plan.storageMb / 1000} GB` : `${plan.storageMb} MB` })}
							</p>
							<ul className="mb-[34px]">
								{FEATURE_KEYS.map((key, i) => {
									const included = plan.features[key];
									return (
										<li key={key} className={`flex items-start ${i !== FEATURE_KEYS.length - 1 ? "mb-12" : ""}`}>
											<AiFillCheckCircle
												size={22}
												color={included ? (dark ? "#fff" : "#313D45") : dark ? "#5B676F" : "#D9D9D9"}
												className="mr-8 mt-2 shrink-0"
											/>
											<span
												className={`text-16 leading-[22px] tracking-[0.4px] ${
													included ? (dark ? "text-white" : "text-textChoosePlan") : dark ? "text-[#7E8990] line-through" : "text-[#B3B3B3] line-through"
												}`}>
												{t(`features.${key}`)}
											</span>
										</li>
									);
								})}
							</ul>
							<div
								onClick={handleToggleSignup}
								className={`mt-auto h-[50px] flex items-center justify-center rounded-8 border border-tabChoosePlan cursor-pointer text-20 font-medium tracking-[0.4px] transition-colors duration-200 hover:bg-tabChoosePlan hover:text-white ${
									dark ? "bg-tabChoosePlan text-white" : "text-tabChoosePlan"
								}`}>
								{t("button")}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
