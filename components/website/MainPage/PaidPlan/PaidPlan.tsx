"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AiFillCheckCircle } from "react-icons/ai";
import free from "@/assets/svgs/plans/free.svg";
import standart from "@/assets/svgs/plans/standart.svg";
import professional from "@/assets/svgs/plans/professional.svg";
import Image from "next/image";
import useAuthFormStore from "@/store/useAuthFormStore";
import { useSiteMenuState } from "@/store/useSiteMenuState";
import { useLocale, useTranslations } from "next-intl";
import { FEATURE_KEYS, PLANS, PlanId, YEAR_MONTHS, limitsLine } from "@/config/plans";
import { formatPlanPrice } from "@/lib/currency";
import PromoBanner from "@/components/shared/PromoBanner";
import PromoModal from "./PromoModal";

const ICONS: Record<PlanId, string> = { free, standard: standart, professional };

// Тарифы (app/config/plans.ts): на десктопе три карточки в ряд, на планшете и телефоне — лента с горизонтальной прокруткой.
// Средняя (Standard) — тёмная. Год = 10 месяцев цены за месяц.

// Длинные суммы в национальной валюте («264 000 soʻm», «6 996 000 soʻm») и длинные названия тарифа
// («Безкоштовний») при кегле 40 px шире самой карточки: замер в браузере — 245 px полезной ширины,
// «Безкоштовний» требует 296 px при 40 px. Поэтому кегль подбирается по длине строки: короткое «€20»
// остаётся крупным, длинное — уменьшается. Обрезанная цена хуже, чем мелкая.
function priceClass(text: string): string {
	const n = text.length;
	if (n >= 16) return "text-[22px] leading-[30px] lg:text-24 lg:leading-[32px]";
	if (n >= 13) return "text-[26px] leading-[34px] lg:text-28 lg:leading-[36px]";
	if (n >= 11) return "text-30 leading-[40px] lg:text-34 lg:leading-[44px]";
	if (n >= 9) return "text-36 leading-[46px] lg:text-40 lg:leading-[48px]";
	return "text-40 leading-[48px]";
}

export default function PaidPlan({ rates: serverRates }: { rates?: Record<string, number> } = {}) {
    const t = useTranslations ("paidPlan")
	const locale = useLocale();
	const router = useRouter();
	const [active, setActive] = useState(t("month"));
	const { toggleSignUpForm } = useAuthFormStore();
	const { menu, toggleMenu } = useSiteMenuState();
	const yearly = active === t("year");
	const [promoOpen, setPromoOpen] = useState(false);
	// Курс приходит с сервера (app/[locale]/page.tsx) — в первом HTML уже цена локали, «прыжка» нет.
	// Клиентский запрос остаётся только подстраховкой: если сервер курс не отдал, цену дотянем из /api/currency.
	const [rates, setRates] = useState<Record<string, number> | null>(serverRates ?? null);
	useEffect(() => {
		if (serverRates) return;
		let alive = true;
		fetch("/api/currency")
			.then((r) => r.json())
			.then((j) => { if (alive && j?.rates) setRates(j.rates); })
			.catch(() => {});
		return () => { alive = false; };
	}, [serverRates]);

	// Кнопки тарифов: у вошедшего пользователя — прямо в кабинет (платный тариф — на страницу оплаты). У гостя пока действует
	// программа «первые 500 — год бесплатно»: кнопка открывает окно с её условиями, а регистрация — по кнопке в этом окне.
	const choosePlan = (planId: PlanId) => {
		let hasToken = false;
		try {
			hasToken = !!localStorage.getItem("token");
		} catch {
			/* приватный режим */
		}
		if (hasToken) {
			router.push(planId === "free" ? `/${locale}/crm` : `/${locale}/crm/upgrade?startPlan=${planId}&interval=${yearly ? "year" : "month"}`);
			return;
		}
		setPromoOpen(true);
	};
	const goRegister = () => {
		setPromoOpen(false);
		toggleSignUpForm();
		if (!menu) toggleMenu();
	};

	const titles: Record<PlanId, string> = { free: t("titleFree"), standard: t("titleStandart"), professional: t("titleProfessional") };
	const subTitles: Record<PlanId, string> = { free: t("subTitleFree"), standard: t("subTitleStandart"), professional: t("subTitleProfessional") };

	const tab = (label: string) => (
		<div
			className={`sm:flex-1 md:flex-none md:w-[150px] h-[55px] text-center flex items-center justify-center rounded-50 cursor-pointer transition-colors duration-300 ${
				active === label ? "bg-tabChoosePlan text-white" : "bg-white text-[#4D4D4D]"
			} font-medium text-20 tracking-[0.4px]`}
			onClick={() => setActive(label)}>
			{label}
		</div>
	);

	return (
		<div>
			<h2 className="text-24 lg:text-36 font-medium text-center sm:mb-[29px] md:mb-30 lg:mb-[59px] text-white leading-[1.4] tracking-[0.48px] lg:tracking-[1px]">
				{t("choosePlan")}
			</h2>
			<PromoBanner />
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
							<p className={`${priceClass(plan.priceMonth === 0 ? titles.free : formatPlanPrice(price, locale, rates))} font-medium tracking-[0.8px] flex flex-wrap items-baseline gap-x-1 ${dark ? "text-white" : "text-[#666666]"}`}>
								{plan.priceMonth === 0 ? (
									titles.free
								) : (
									<>
										{formatPlanPrice(price, locale, rates)}
										<span className="text-20 font-normal tracking-[0.4px]">/{yearly ? t("year") : t("month")}</span>
									</>
								)}
							</p>
							<p className={`text-16 leading-[24px] tracking-[0.4px] ${dark ? "text-white" : "text-[#5A5A5A]"}`}>
								{subTitles[plan.id]}
							</p>
							<p className={`text-14 leading-[20px] tracking-[0.4px] mb-[35px] min-h-[20px] ${dark ? "text-[#C7CDD1]" : "text-[#5A5A5A]"}`}>
								{limitsLine(plan, t)}
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
													included ? (dark ? "text-white" : "text-textChoosePlan") : dark ? "text-[#A8B2BA] line-through" : "text-[#6B6B6B] line-through"
												}`}>
												{t(`features.${key}`)}
											</span>
										</li>
									);
								})}
							</ul>
							<div
								onClick={() => choosePlan(plan.id)}
								className={`mt-auto h-[50px] flex items-center justify-center rounded-8 border border-tabChoosePlan cursor-pointer text-20 font-medium tracking-[0.4px] transition-colors duration-200 hover:bg-tabChoosePlan hover:text-white ${
									dark ? "bg-tabChoosePlan text-white" : "text-[#4A5FBF]"
								}`}>
								{t("button")}
							</div>
						</div>
					);
				})}
			</div>
			<PromoModal open={promoOpen} onClose={() => setPromoOpen(false)} onRegister={goRegister} />
		</div>
	);
}
