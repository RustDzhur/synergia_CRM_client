"use client";
import DemoButton from "@/components/website/DemoButton";
import "react";
import { useTranslations } from "next-intl";
import { TbArrowRight, TbPlayerPlayFilled } from "react-icons/tb";
import HeroAppFrame from "./HeroAppFrame";

// Шапка лендинга: слева обещание и два действия, справа витрина кабинета (см. HeroAppFrame).
// Кнопка «Plattformkonzept ansehen» ведёт к разделу с тарифами, «Ablauf kennenlernen» — к блоку о том, как это работает.
export default function Hero() {
	const t = useTranslations("hero");

	return (
		<div className="pb-40 pt-20 sm:pb-[18px] md:pb-[23px] lg:flex lg:items-center lg:gap-60 lg:pb-[120px] lg:pt-[40px]">
			<div className="lg:w-600 lg:shrink-0">
				<p className="fs-eyebrow fs-eyebrow-dot">{t("eyebrow")}</p>
				<h1 className="mt-20 text-[34px] font-semibold leading-[1.06] tracking-[-1.1px] text-[#f1f4ee] sm:text-[40px] lg:mt-24 lg:text-[62px] lg:tracking-[-2px]">
					{t("title1")}
					<br />
					{t("title2")}
					<br />
					<span className="text-[#c6ff4d]">{t("title3")}</span>
				</h1>
				<h2 className="mt-20 max-w-560 text-15 leading-[1.65] text-[#8c948b] lg:mt-26 lg:text-16">
					{t("lead")}
				</h2>
				<div className="mt-26 flex flex-wrap items-center gap-12 lg:mt-34 lg:gap-14">
					<button
						type="button"
						onClick={() => document.getElementById("choose-plan")?.scrollIntoView({ behavior: "smooth" })}
						className="fs-btn fs-btn-primary h-50 flex-1 px-24 text-14 sm:flex-none lg:px-26">
						{t("ctaPrimary")}
						<TbArrowRight size={18} />
					</button>
					<DemoButton className="fs-btn fs-btn-ghost h-50 flex-1 px-24 text-14 text-[#c6ff4d] sm:flex-none lg:px-26" />
					<button
						type="button"
						onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
						className="fs-btn fs-btn-ghost h-50 flex-1 px-24 text-14 sm:flex-none lg:px-26">
						<TbPlayerPlayFilled size={15} />
						{t("ctaSecondary")}
					</button>
				</div>
			</div>

			<div className="mt-40 min-w-0 lg:mt-0 lg:flex-1">
				<HeroAppFrame />
			</div>
		</div>
	);
}
