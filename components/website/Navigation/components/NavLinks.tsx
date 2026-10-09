"use client";
import { withLocale } from "@/utils/locale";
import "react";
import NavLink from "./NavLink";
import SwitchLanguage from "./SwitchLanguage";
import { useTranslations } from "next-intl";
import { useLanguageStore } from "@/store/useLanguageStore";

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
		<ul className="flex items-center min-w-0">
			{commonLinks.map((link) => (
				<li className="font-medium whitespace-nowrap lg:mr-18 lg:text-14 lg:tracking-[0.2px]" key={link.path}>
					<NavLink href={link.path}>{link.label}</NavLink>
				</li>
			))}
			<li className="cursor-pointer">
				<SwitchLanguage />
			</li>
		</ul>
	);
}
