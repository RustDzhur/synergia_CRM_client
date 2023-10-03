"use client";
import React from "react";
import Link from "next/link";
import { IconContext } from "react-icons";
import Logo from "../Navigation/components/Logo";
import { FaFacebookF } from "react-icons/fa";
import { BsTwitter } from "react-icons/bs";
import { AiOutlineInstagram } from "react-icons/ai";
import { ImLinkedin2 } from "react-icons/im";
import { useLanguageStore } from "@/app/store/useLanguageStore";

export default function Footer() {
	const { selectedLanguage } = useLanguageStore();

	const socialIcons = [
		{ icon: <FaFacebookF />, key: "facebook" },
		{ icon: <BsTwitter />, key: "twitter" },
		{ icon: <AiOutlineInstagram />, key: "instagram" },
		{ icon: <ImLinkedin2 />, key: "linkedin" },
	];
	return (
		<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto bg-footer">
			<div className=" sm:px-12 sm:py-50 md:px-20 md:py-40 lg:px-100 lg:py-80">
				<div className="flex justify-center mb-40 md:mb-0 md:hidden">
					<Logo />
				</div>
				<div className="flex justify-between sm:mb-30 md:mb-40 lg:mb-0">
					<div className="sm:hidden md:block">
						<Logo />
					</div>
					<div className="">
						<ul className="text-14 md:text-18 leading-[1.7] tracking-[0.28px] md:tracking-[0.36px] text-white">
							<li className="mb-30">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/careers"
											: `/${selectedLanguage.code}/careers`
									}>
									Careers
								</Link>
							</li>
							<li className="mb-30">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/privacypolicy"
											: `/${selectedLanguage.code}/privacypolicy`
									}>
									Privacy policy
								</Link>
							</li>
							<li className="mb-30 lg:mb-0">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/documentation"
											: `/${selectedLanguage.code}/documentation`
									}>
									Documentation
								</Link>
							</li>
							<li className="mb-30 lg:hidden">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/about"
											: `/${selectedLanguage.code}/about`
									}>
									About Us
								</Link>
							</li>
							<li className="lg:hidden">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/team"
											: `/${selectedLanguage.code}/team`
									}>
									Team
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<ul className="text-14 md:text-18 leading-[1.7] tracking-[0.28px] md:tracking-[0.36px] text-white">
							<li className="mb-30">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/support"
											: `/${selectedLanguage.code}/support`
									}>
									Support / FAQ
								</Link>
							</li>
							<li className="mb-30">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/features"
											: `/${selectedLanguage.code}/features`
									}>
									Features
								</Link>
							</li>
							<li className="mb-30 lg:mb-0">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/referral"
											: `/${selectedLanguage.code}/referral`
									}>
									Referral program
								</Link>
							</li>
							<li className="lg:hidden">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/contacts"
											: `/${selectedLanguage.code}/contacts`
									}>
									Contacts
								</Link>
							</li>
						</ul>
					</div>
					<div className="sm:hidden lg:block">
						<ul className="text-14 md:text-18 leading-[1.7] tracking-[0.28px] md:tracking-[0.36px] text-white">
							<li className="md:block mb-30">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/about"
											: `/${selectedLanguage.code}/about`
									}>
									About Us
								</Link>
							</li>
							<li className="md:block mb-30">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/team"
											: `/${selectedLanguage.code}/team`
									}>
									Team
								</Link>
							</li>
							<li className="md:block">
								<Link
									href={
										selectedLanguage.code === "ua"
											? "/contacts"
											: `/${selectedLanguage.code}/contacts`
									}>
									Contacts
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
										className="flex items-center justify-center w-35 h-35 rounded-35 hover:bg-[#FF008A] bg-primaryColor mr-6">
										{social.icon}
									</li>
								))}
							</ul>
						</IconContext.Provider>
					</div>
				</div>

				<div className="lg:hidden">
					<IconContext.Provider value={{ size: "17px", color: "#fff" }}>
						<ul className="flex items-center justify-center md:justify-end">
							{socialIcons.map((social, index) => (
								<li
									key={index}
									className="flex items-center justify-center w-35 h-35 rounded-35 hover:bg-[#FF008A] bg-primaryColor mr-6">
									{social.icon}
								</li>
							))}
						</ul>
					</IconContext.Provider>
				</div>
			</div>
		</div>
	);
}
