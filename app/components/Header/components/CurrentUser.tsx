"use client";
import Image from "next/image";
import React, { useState } from "react";
import user from "@/app/assets/images/user.png";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";

export default function CurrentUser() {
	const [isDropDown, setIsDropDown] = useState(false);
	const handleDropDown = () => {
		setIsDropDown(!isDropDown);
	};
	return (
		<div onClick={handleDropDown} className="flex items-center relative">
			<div className=" w-50 mr-8">
				<Image src={user} alt="user" />
			</div>
			<div className="mr-8">
				<p className="text-18 font-medium">Rustem Dzhuraiev</p>
			</div>
			<IconContext.Provider value={{ size: "18px" }}>
				{isDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
			</IconContext.Provider>
			{isDropDown && (
				<ul className="absolute right-0 top-full w-full bg-headerBackground border-b-switchCompany rounded-b-8">
					<li className="  py-15 px-20 cursor-pointer">
						<p className="font-medium text-16 leading-16 text-black">
							Log out
						</p>
					</li>
					<li className="border-t-switchCompany py-15 px-20 cursor-pointer">
						<p className="font-medium text-16 leading-16 text-black">
							Settings
						</p>
					</li>
				</ul>
			)}
		</div>
	);
}
