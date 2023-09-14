import React from "react";
import NavLink from "./NavLink";
import SwitchLanguage from "./SwitchLanguage";
import { useTranslations } from "next-intl";

export default function Links() {
	const t = useTranslations('navWebsite')
	return (
		<ul className="flex items-center">
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/">{t('home')}</NavLink>
			</li>
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/about">{t('about_us')}</NavLink>
			</li>
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/services">{t("our_services")}</NavLink>
			</li>
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/blog">{t("blog")}</NavLink>
			</li>
			<li className="lg:mr-40 font-medium lg:text-18">
				<NavLink href="/contacts">{t("contact")}</NavLink>
			</li>

			<li className="cursor-pointer"><SwitchLanguage/></li>
		</ul>
	);
}
