"use client";
import Image from "next/image";
import React from "react";
// Скриншот CRM в макете свой для каждой ширины (с раскрытым сайдбаром); в файлах есть поля под тень (8px), поэтому размеры 541 / 494 / 100%
import heroDesk from "@/app/assets/images/crm_desk_hero@2.jpg";
import heroTab from "@/app/assets/images/crm_tab_hero@2.jpg";
import heroMob from "@/app/assets/images/crm_mob_hero@2.jpg";
import { useTranslations } from "next-intl";

export default function Hero() {
    const t= useTranslations('hero')
	return (
		<div className="md:text-center lg:flex lg:justify-between lg:items-start sm:pb-[18px] md:pb-[23px] lg:pb-[160px]">
			<div className="lg:w-610 lg:text-left">
				<h1 className="sm:text-[28px] md:text-32 lg:text-50 font-semibold text-discover sm:leading-[55px] md:leading-[175%] lg:leading-[87px] tracking-[0.64px] lg:tracking-[1.1px] sm:mb-8 lg:mb-[-3px] md:text-center lg:text-left">
					<span className="text-primaryColor">{t('title.span')}</span> {t('title.body')}
				</h1>
				<h2 className="sm:text-15 lg:text-18 text-[#999] sm:leading-[175%] lg:leading-[31px] tracking-[0.3px] lg:tracking-[0.4px] sm:mb-40 md:mb-30 lg:mb-[41px] md:text-center lg:text-left lg:w-505">
					{t('subtitle')}
				</h2>
				<button
					type="button"
					onClick={() => document.getElementById("choose-plan")?.scrollIntoView({ behavior: "smooth" })}
					className="sm:w-full md:w-auto bg-authBtn text-center sm:px-30 sm:py-[12px] sm:leading-[28px] md:px-40 lg:px-[30px] text-white text-18 font-medium lg:tracking-[0.5px] sm:mb-50">
					{t('plan')}
				</button>
			</div>

			<div className="flex justify-center sm:-mx-12 md:mx-0 lg:-mr-[8px]">
				<Image src={heroDesk} alt="screen crm" priority className="hidden lg:block lg:w-[541px] lg:h-auto" />
				<Image src={heroTab} alt="screen crm" priority className="hidden md:block lg:hidden md:w-[494px] md:h-auto" />
				<Image src={heroMob} alt="screen crm" priority className="md:hidden w-full h-auto" />
			</div>
		</div>
	);
}
