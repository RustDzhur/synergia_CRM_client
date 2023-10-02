'use client'
import React from "react";
import { IconContext } from "react-icons";
import Logo from "../Navigation/components/Logo";
import { FaFacebookF } from "react-icons/fa";
import { BsTwitter } from "react-icons/bs";
import { AiOutlineInstagram } from "react-icons/ai";
import { ImLinkedin2 } from "react-icons/im";

export default function Footer() {
	return (
		<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto bg-footer">
			<div className="sm:px-12 sm:py-50 md:px-20 md:py-40 lg:px-100 lg:py-80">
				<Logo />
				<ul>
					<li>Careers</li>
					<li>Privacy policy</li>
					<li>Documentation</li>
				</ul>
				<ul>
					<li>Support / FAQ</li>
					<li>Features</li>
					<li>Referral program</li>
				</ul>
				<ul>
					<li>About Us</li>
					<li>Team</li>
					<li>Contact</li>
				</ul>
				<IconContext.Provider value={{ size: "17px", color: "#fff" }}>
					<ul className="flex items-center justify-center">
						<li className=" flex items-center justify-center w-35 h-35 rounded-35 hover:bg-[#FF008A] bg-primaryColor mr-6"><FaFacebookF/></li>
						<li className=" flex items-center justify-center w-35 h-35 rounded-35 hover:bg-[#FF008A] bg-primaryColor mr-6"><BsTwitter/></li>
						<li className=" flex items-center justify-center w-35 h-35 rounded-35 hover:bg-[#FF008A] bg-primaryColor mr-6"><AiOutlineInstagram/></li>
						<li className=" flex items-center justify-center w-35 h-35 rounded-35 hover:bg-[#FF008A] bg-primaryColor"><ImLinkedin2/></li>
					</ul>
				</IconContext.Provider>
			</div>
		</div>
	);
}
