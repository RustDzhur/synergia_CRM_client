"use client";
import { withLocale } from "@/app/utils/locale";
import React from "react";
import Link from "next/link";
import { IconContext } from "react-icons";
import Logo from "../Navigation/components/Logo";
import { FaFacebookF } from "react-icons/fa";
import { BsTwitter } from "react-icons/bs";
import { AiOutlineInstagram } from "react-icons/ai";
import { ImLinkedin2 } from "react-icons/im";
import { useLanguageStore } from "@/app/store/useLanguageStore";
import { useTranslations } from "next-intl";

// slanted — скошенный верх футера (по макету только на главной странице)
export default function Footer({ slanted = false }: { slanted?: boolean }) {
	const t = useTranslations("footer");
	const { selectedLanguage } = useLanguageStore();

	const socialIcons = [
		{ icon: <FaFacebookF />, key: "facebook" },
		{ icon: <BsTwitter />, key: "twitter" },
		{ icon: <AiOutlineInstagram />, key: "instagram" },
		{ icon: <ImLinkedin2 />, key: "linkedin" },
	];
	return (
		<div className={`sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto bg-footer ${slanted ? "lg:[clip-path:polygon(0_105px,100%_0,100%_100%,0_100%)]" : ""}`}>
			<div className={`sm:px-12 sm:py-50 md:px-20 md:py-40 lg:px-100 ${slanted ? "lg:pt-[187px]" : "lg:pt-[82px]"} lg:pb-[73px]`}>
				<div className="flex justify-start mb-40 md:mb-0 md:hidden">
					<Logo light />
				</div>
				<div className="flex justify-between sm:mb-[39px] md:mb-[48px] lg:mb-0 lg:grid lg:grid-cols-[283px_281px_293px_1fr_auto]">
					<div className="sm:hidden md:block lg:-translate-y-[4px]">
						<Logo light />
					</div>
					<div className="">
						<ul className="text-14 md:text-18 leading-[1.7] lg:leading-[29.5px] tracking-[0.28px] md:tracking-[0.36px] lg:tracking-[0.4px] font-medium text-[#E6E6E6]">
							<li className="mb-30">
								<Link
									href={
										withLocale(selectedLanguage.code, "/careers")
									}>
									{t("careers")}
								</Link>
							</li>
							<li className="mb-30">
								<Link
									href={
										withLocale(selectedLanguage.code, "/privacypolicy")
									}>
									{t("privacyPolicy")}
								</Link>
							</li>
							<li className="mb-30 lg:mb-0">
								<Link
									href={
										withLocale(selectedLanguage.code, "/documentation")
									}>
									{t("documentation")}
								</Link>
							</li>
							<li className="mb-30 lg:hidden">
								<Link
									href={
										withLocale(selectedLanguage.code, "/about")
									}>
									{t("aboutUs")}
								</Link>
							</li>
							<li className="lg:hidden">
								<Link
									href={
										withLocale(selectedLanguage.code, "/team")
									}>
									{t("team")}
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<ul className="text-14 md:text-18 leading-[1.7] lg:leading-[29.5px] tracking-[0.28px] md:tracking-[0.36px] lg:tracking-[0.4px] font-medium text-[#E6E6E6]">
							<li className="mb-30">
								<Link
									href={
										withLocale(selectedLanguage.code, "/support")
									}>
									{t("support")}
								</Link>
							</li>
							<li className="mb-30">
								<Link
									href={
										withLocale(selectedLanguage.code, "/features")
									}>
									{t("features")}
								</Link>
							</li>
							<li className="mb-30 lg:mb-0">
								<Link
									href={
										withLocale(selectedLanguage.code, "/referral")
									}>
									{t("referral")}
								</Link>
							</li>
							<li className="lg:hidden">
								<Link
									href={
										withLocale(selectedLanguage.code, "/contacts")
									}>
									{t("contacts")}
								</Link>
							</li>
						</ul>
					</div>
					<div className="sm:hidden lg:block">
						<ul className="text-14 md:text-18 leading-[1.7] lg:leading-[29.5px] tracking-[0.28px] md:tracking-[0.36px] lg:tracking-[0.4px] font-medium text-[#E6E6E6]">
							<li className="md:block mb-30">
								<Link
									href={
										withLocale(selectedLanguage.code, "/about")
									}>
									{t("aboutUs")}
								</Link>
							</li>
							<li className="md:block mb-30">
								<Link
									href={
										withLocale(selectedLanguage.code, "/team")
									}>
									{t("team")}
								</Link>
							</li>
							<li className="md:block">
								<Link
									href={
										withLocale(selectedLanguage.code, "/contacts")
									}>
									{t("contacts")}
								</Link>
							</li>
						</ul>
					</div>
					<div className="hidden lg:block">
						<IconContext.Provider value={{ size: "17px", color: "#fff" }}>
							<ul className="flex items-center justify-center md:justify-end">
								{socialIcons.map((social, index) => (
									<li
										key={index}
										className="flex items-center justify-center w-35 h-35 rounded-35 hover:bg-[#FF008A] bg-primaryColor mr-6 last:mr-0">
										{social.icon}
									</li>
								))}
							</ul>
						</IconContext.Provider>
					</div>
				</div>

				<div className="lg:hidden">
					<IconContext.Provider value={{ size: "17px", color: "#fff" }}>
						<ul className="flex items-center justify-start md:justify-end">
							{socialIcons.map((social, index) => (
								<li
									key={index}
									className="flex items-center justify-center w-35 h-35 rounded-35 hover:bg-[#FF008A] bg-primaryColor mr-6 last:mr-0">
									{social.icon}
								</li>
							))}
						</ul>
					</IconContext.Provider>
				</div>

				<div className="mt-30 flex flex-col gap-14 border-t border-[#3D3D3D] pt-20 text-12 text-[#B3B3B3] md:mt-40 md:flex-row md:items-center md:justify-between md:pt-30 lg:mt-[50px]">
					<p>{t("rights", { year: new Date().getFullYear() })}</p>
					<ul className="flex flex-wrap gap-x-20 gap-y-8">
						<li><Link href={withLocale(selectedLanguage.code, "/impressum")} className="hover:text-white">{t("impressum")}</Link></li>
						<li><Link href={withLocale(selectedLanguage.code, "/agb")} className="hover:text-white">{t("terms")}</Link></li>
						<li><Link href={withLocale(selectedLanguage.code, "/privacypolicy")} className="hover:text-white">{t("privacyPolicy")}</Link></li>
					</ul>
				</div>
			</div>
		</div>
	);
}
