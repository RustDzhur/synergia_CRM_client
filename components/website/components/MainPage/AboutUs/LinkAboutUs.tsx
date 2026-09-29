'use client'
import { useLanguageStore } from "@/store/useLanguageStore";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { withLocale } from "@/utils/locale";
import "react";

export default function LinkAboutUs() {
	const { selectedLanguage } = useLanguageStore();
    const t = useTranslations('aboutUs')

	return (
		<Link
			className="text-white sm:text-18 font-medium hover:text-authBtn md:text-16 lg:text-18 lg:tracking-[0.4px]"
			href={
				withLocale(selectedLanguage.code, "/about")
			}>
			{t('link')}
		</Link>
	);
}
