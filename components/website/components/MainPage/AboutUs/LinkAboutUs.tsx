'use client'
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";

export default function LinkAboutUs() {
	const { selectedLanguage } = useLanguageStore();
    const t = useTranslations('aboutUs')

	return (
		<Link
			className="text-white sm:text-18 sm:font-bold hover:text-authBtn md:text-16 lg:text-18"
			href={
				selectedLanguage.code === "ua"
					? "/about"
					: `/${selectedLanguage.code}/about`
			}>
			{t('link')}
		</Link>
	);
}
