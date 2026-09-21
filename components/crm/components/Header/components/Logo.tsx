"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import logoMob from "@/app/assets/images/logoMob.png";

// Логотип в шапке CRM: по клику — на дашборд (главная страница личного кабинета)
export default function Logo() {
	const locale = useLocale();
	return (
		<Link href={`/${locale}/crm`} aria-label="Dashboard" className="flex items-center">
			<Image
				src={logoMob}
				alt="logo"
				className="mr-8 h-40 w-40 lg:h-50 lg:w-50"
			/>
			<div className="text-primaryColor text-16 lg:text-20 font-medium leading-normal text-center">
				<p>Firmspace</p>
				<span className="font-bold">CRM</span>
			</div>
		</Link>
	);
}
