import React from "react";
import LinkAboutUs from "./LinkAboutUs";
import Image from "next/image";
import aboutUs from "@/app/assets/images/aboutUs.jpg";
import { useTranslations } from "next-intl";

export default function AboutUs() {
    const t = useTranslations('aboutUs')
	return (
		<div className="md:relative">
			<div className="md:absolute sm:px-12 sm:py-40 sm:text-center md:bottom-0 md:right-0 md:p-20 md:text-left md:bg-aboutUsBackground md:rounded-t-10 md:rounded-br-10 lg:px-35 lg:py-44">
				<div className="md:w-331 lg:w-512">
					<h2 className="text-authBtn sm:text-18 sm:tracking-[0.36px] sm:mb-20 md:text-16 md:mb-12 font-bold lg:text-18">
						{t('title')}
					</h2>
					<h3 className="text-white sm:text-24 sm:tracking-[0.48x] sm:leading-[140%] md:text-26 md:mb-12 md:tracking-[0.52x] sm:mb-25 font-bold lg:text-36">
						{t('description')}
					</h3>
					<div className="sm:mb-15">
						<LinkAboutUs />
					</div>
				</div>
			</div>
			<Image src={aboutUs} alt="aboutUs" className="md:w-478 lg:w-895 md:rounded-8" />
		</div>
	);
}
