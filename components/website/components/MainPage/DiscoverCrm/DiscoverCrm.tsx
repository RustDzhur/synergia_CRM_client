"use client";
import "react";
import Slider from "react-slick";
import { AiFillCheckCircle } from "react-icons/ai";
import { useTranslations } from "next-intl";
import HeroAppFrame, { type FrameScreen } from "../Hero/HeroAppFrame";

// Точки слайдера в макете — четыре кружка (стиль .discover-dots в globals.css)
const settings = {
	dots: true,
	dotsClass: "slick-dots discover-dots",
	initialSlide: 0,
	customPaging: () => <span />,
	infinite: true,
	speed: 500,
	slidesToShow: 1,
	slidesToScroll: 1,
	autoplay: true,
	autoplaySpeed: 4000,
	fade: true,
};

export default function DiscoverCrm() {
	const t = useTranslations("discoverCrm");
	const lists = [
		{ icon: AiFillCheckCircle, text: t("comprehensive") },
		{ icon: AiFillCheckCircle, text: t("efficiency") },
		{ icon: AiFillCheckCircle, text: t("insights") },
		{ icon: AiFillCheckCircle, text: t("integration") },
	];
	// Раньше здесь были четыре снимка старого светлого интерфейса с прежним названием продукта —
	// они не имели ничего общего с текущим кабинетом. Теперь слайды рисуются той же разметкой,
	// что и витрина в шапке, и показывают реальные разделы.
	const screens: FrameScreen[] = ["overview", "crm", "chat", "finance"];

	return (
		<div className="text-[#f1f4ee]">
			<h2 className="text-24 lg:text-36 font-medium leading-[1.4] tracking-[0.48px] lg:tracking-[1px] sm:mb-20 lg:mb-[50px]">
				{t("title")}
			</h2>
			<div className="lg:flex lg:justify-between">
				<div className="lg:w-[495px]">
					<p className="text-18 md:text-16 lg:text-18 leading-[27px] lg:leading-[31px] tracking-[0.4px] mb-[22px] md:mb-[27px] lg:mb-[39px]">
						{t("description")}
					</p>
					<div className="sm:mb-[46px] md:mb-[68px] lg:mb-0">
						{lists.map((item, index) => (
							<div
								key={index}
								className={`flex items-center ${
									index === lists.length - 1 ? "" : "mb-12"
								}`}>
								<div className="mr-[11px] text-[24px] leading-none">
									<item.icon />
								</div>
								<p className="text-18 leading-[31px] tracking-[0.5px] font-medium">
									{item.text}
								</p>
							</div>
						))}
					</div>
				</div>

				<div className="sm:-mx-12 md:mx-auto md:w-525 lg:m-0 lg:pt-[27px] discover-slider">
					<Slider {...settings}>
						{screens.map((screen) => (
							<div key={screen}>
								<HeroAppFrame screen={screen} />
							</div>
						))}
					</Slider>
				</div>
			</div>
		</div>
	);
}
