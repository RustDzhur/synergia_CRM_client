"use client";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useLocale } from "next-intl";
import logoMob from "@/app/assets/images/logoMob.png";
import { withLocale } from "@/app/utils/locale";

// Логотип сайта: по клику — на главную страницу выбранного языка
export default function Logo({ light = false }: { light?: boolean }) {
	const locale = useLocale();
	return (
		<Link href={withLocale(locale, "/")} aria-label="Firmspace CRM" className="flex items-center">
			<Image
				src={logoMob}
				alt="logo"
				className="sm:w-40 lg:w-50 sm:h-40 lg:h-50 mr-8 lg:mr-[11px]"
			/>
			<div className={`${light ? "text-white" : "text-primaryColor"} sm:text-16 lg:text-18 font-medium leading-normal tracking-[0.6px] lg:tracking-[0.3px] text-center`}>
				<p>Firmspace</p>
				<span className="font-bold">CRM</span>
			</div>
		</Link>
	);
}
