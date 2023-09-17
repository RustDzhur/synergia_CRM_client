"use client";
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
			path: selectedLanguage.code === "ua" ? "/" : `/${selectedLanguage.code}`,
			label: t("home"),
		},
		{
			path:
				selectedLanguage.code === "ua"
					? "/about"
					: `/${selectedLanguage.code}/about`,
			label: t("about_us"),
		},
		{
			path:
				selectedLanguage.code === "ua"
					? "/services"
					: `/${selectedLanguage.code}/services`,
			label: t("our_services"),
		},
		{
			path:
				selectedLanguage.code === "ua"
					? "/blog"
					: `/${selectedLanguage.code}/blog`,
			label: t("blog"),
		},
		{
			path:
				selectedLanguage.code === "ua"
					? "/contacts"
					: `/${selectedLanguage.code}/contacts`,
			label: t("contact"),
		},
	];

	return (
		<ul className="flex items-center">
			{commonLinks.map((link) => (
				<li className="lg:mr-40 font-medium lg:text-18" key={link.path}>
					<NavLink href={link.path}>{link.label}</NavLink>
				</li>
			))}
			<li className="cursor-pointer">
				<SwitchLanguage />
			</li>
		</ul>
	);
}
