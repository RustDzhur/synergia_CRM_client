import React from "react";
import Image from "next/image";
import logoMob from "@/app/assets/images/logoMob.png";

export default function Logo() {
	return (
		<div className="flex items-center ">
			<Image
				src={logoMob}
				alt="logo"
				className="mr-8 sm:w-40 sm:h-40 md:w-50 md:h-50"
			/>
			<div className="text-primaryColor sm:text-16 md:text-18 lg:text-20 font-medium leading-normal tracking-wider text-center">
				<p>Synergia</p>
				<span className="font-bold">CRM</span>
			</div>
		</div>
	);
}
