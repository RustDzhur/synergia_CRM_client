import React from "react";
import LinkAboutUs from "./LinkAboutUs";
import Image from "next/image";
import aboutUs from "@/app/assets/images/aboutUs.jpg";
import { useTranslations } from "next-intl";

// Фото с тёмной карточкой поверх (planшет и десктоп) или карточка над фото (телефон).
// Размеры по макету: десктоп — фото 895×523, карточка 590×300; планшет — фото 478×325, карточка 392 в ширину.
export default function AboutUs() {
    const t = useTranslations('aboutUs')
	return (
		<div className="md:relative">
			<div className="md:absolute sm:px-12 sm:py-40 sm:text-center md:bottom-0 md:right-0 md:p-20 md:pt-[17px] md:h-[204px] lg:h-[300px] md:text-left md:bg-aboutUsBackground md:rounded-t-10 md:rounded-br-10 md:w-[392px] lg:w-[590px] lg:rounded-16 lg:px-35 lg:pt-[30px] lg:pb-0">
				<div className="md:w-full">
					<h2 className="text-authBtn sm:text-18 sm:tracking-[0.36px] sm:mb-20 md:text-16 md:mb-[11px] font-medium lg:text-18 lg:tracking-[0.4px] lg:leading-[27px] lg:mb-10">
						{t('title')}
					</h2>
					<h3 className="text-white sm:text-24 sm:tracking-[0.48px] sm:leading-[140%] md:text-[26px] md:leading-[35px] md:mb-[22px] md:tracking-[0.52px] sm:mb-25 font-medium lg:text-36 lg:leading-[48px] lg:tracking-[1px] lg:mb-[26px]">
						{t('description')}
					</h3>
					<div className="sm:mb-15 lg:mb-0">
						<LinkAboutUs />
					</div>
				</div>
			</div>
			<Image src={aboutUs} alt="aboutUs" className="sm:w-full sm:h-[250px] md:w-478 md:h-[325px] lg:w-895 lg:h-[523px] object-cover md:rounded-8 lg:rounded-16" />
		</div>
	);
}
