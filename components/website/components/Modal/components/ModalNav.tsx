"use client";
import React from "react";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import { IconContext } from "react-icons";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { useTranslations } from "next-intl";
import NavLink from "./NavLinkStyle";

export default function ModalMobNav() {
	const { menu, toggleMenu } = useToggleMenuState();
	const { selectedLanguage } = useLanguageStore();

	const t = useTranslations("navWebsite");

	const handleCloseModal = () => {
		toggleMenu();
	};

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
		<div
			className={`${
				!menu && "flex-col items-left inline-block"
			}    sm:w-[100vw] md:w-auto inline-block`}>
			<IconContext.Provider value={{ color: "#B3B3B3" }}>
				<ul>
					{commonLinks.map((link, index) => (
						<li
							onClick={handleCloseModal}
							key={index}
							className={`px-20 py-16 flex items-center cursor-pointer`}>
							<NavLink href={link.path}><p className="text-24 font-medium">{link.label}</p></NavLink>
						</li>
					))}
				</ul>
			</IconContext.Provider>
		</div>
	);
}
