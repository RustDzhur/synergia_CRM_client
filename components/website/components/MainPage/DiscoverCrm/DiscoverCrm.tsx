"use client";
import React from "react";
import Image from "next/image";
import Slider from "react-slick";
import { AiFillCheckCircle } from "react-icons/ai";

import calendar from "@/public/images/slider/calendar.jpg";
import crm from "@/public/images/slider/crm.jpg";
import dashboard from "@/public/images/slider/dashboard.jpg";
import feed from "@/public/images/slider/feed.jpg";
import { useTranslations } from "next-intl";

// Точки слайдера в макете — четыре кружка (стиль .discover-dots в globals.css)
const settings = {
	dots: true,
	dotsClass: "slick-dots discover-dots",
	customPaging: () => <span />,
	infinite: true,
	speed: 500,
	slidesToShow: 1,
	slidesToScroll: 1,
	autoplay: true,
	autoplaySpeed: 3000,
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
	// в макете четыре слайда (четыре точки)
	const gallery = [{ original: dashboard }, { original: feed }, { original: calendar }, { original: crm }];
	return (
		<div className="text-discover">
			<h2 className="text-24 lg:text-36 font-medium leading-[1.4] tracking-[0.48px] lg:tracking-[1px] sm:mb-20 lg:mb-[50px]">
				{t("title")}
			</h2>
			<div className="lg:flex lg:justify-between">
				<div className="lg:w-[495px]">
					<p className="text-16 lg:text-18 leading-[27px] lg:leading-[31px] tracking-[0.4px] mb-[35px] lg:mb-[39px]">
						{t("description")}
					</p>
					<div className="sm:mb-50 lg:mb-0">
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

				<div className="md:w-525 md:mx-auto lg:m-0 lg:pt-[27px] discover-slider">
					<Slider {...settings}>
						{gallery.map((item, index) => (
							<div key={index}>
								<Image src={item.original} alt={`Image ${index}`} />
							</div>
						))}
					</Slider>
				</div>
			</div>
		</div>
	);
}
