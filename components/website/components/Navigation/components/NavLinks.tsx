"use client";
import { withLocale } from "@/app/utils/locale";
import React from "react";
import NavLink from "./NavLink";
import SwitchLanguage from "./SwitchLanguage";
import { useTranslations } from "next-intl";
import { useLanguageStore } from "@/app/store/useLanguageStore";

export default function Links() {
	const t = useTranslations("navWebsite");
	const { selectedLanguage } = useLanguageStore();

	const commonLinks = [
		{
			path: withLocale(selectedLanguage.code, "/"),
			label: t("home"),
		},
		{
			path:
				withLocale(selectedLanguage.code, "/about"),
			label: t("about_us"),
		},
		{
			path:
				withLocale(selectedLanguage.code, "/services"),
			label: t("our_services"),
		},
		{
			path:
				withLocale(selectedLanguage.code, "/blog"),
			label: t("blog"),
		},
		{
			path:
				withLocale(selectedLanguage.code, "/contacts"),
			label: t("contact"),
		},
	];

	return (
		<ul className="flex items-center">
			{commonLinks.map((link) => (
				<li className="lg:mr-40 font-medium lg:text-18 lg:tracking-[0.4px]" key={link.path}>
					<NavLink href={link.path}>{link.label}</NavLink>
				</li>
			))}
			<li className="cursor-pointer">
				<SwitchLanguage />
			</li>
		</ul>
	);
}
