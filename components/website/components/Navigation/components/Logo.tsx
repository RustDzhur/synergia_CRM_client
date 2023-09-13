import Image from "next/image";
import React from "react";
import logoMob from "@/app/assets/images/logoMob.png";

export default function Logo() {
	return (
		<div className="flex items-center">
			<Image
				src={logoMob}
				alt="logo"
				className="sm:w-40 lg:w-50 sm:h-40 lg:h-50 mr-8"
			/>
			<div className="text-primaryColor sm:text-16 lg:text-20 font-medium leading-normal tracking-wider text-center">
				<p>Synergia</p>
				<span className="font-bold">CRM</span>
			</div>
		</div>
	);
}
