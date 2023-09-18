import Image from "next/image";
import React from "react";
import screencrm from "@/app/assets/images/crm_mob_hero@1.jpg";
import { useTranslations } from "next-intl";

export default function Hero() {
    const t= useTranslations('hero')
	return (
		<div className="md:text-center lg:flex lg:justify-between sm:pb-20 md:pb-60 lg:pb-175">
			<div className="lg:w-610  lg:text-left">
				<h1 className="sm:text-32 lg:text-50 font-bold sm:leading-[175%] tracking-[0.64px] lg:tracking-[1px] sm:mb-8 md:text-center lg:text-left">
					<span className="text-primaryColor">{t('title.span')}</span> {t('title.body')}
				</h1>
				<h2 className="sm:text-15 lg:text-18 text-[#999] sm:leading-[175%] tracking-[0.3px] lg:tracking-[0.36px] sm:mb-40 md:mb-30 md:text-center lg:text-left lg:w-505">
					{t('subtitle')}
				</h2>
				<button className="sm:w-full md:w-auto bg-authBtn text-center sm:px-30 sm:py-15 md:px-40 text-white text-18 font-medium sm:mb-50">
					{t('plan')}
				</button>
			</div>

			<div className="flex justify-center">
				<Image
					src={screencrm}
					alt="screen crm"
					className="sm:w-full md:w-475 lg:w-525 md:shadow-heroImage md:rounded-16"
				/>
			</div>
		</div>
	);
}
