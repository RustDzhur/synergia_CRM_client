import React from "react";
import Image from "next/image";
import logoMob from "@/app/assets/images/logoMob.png";

export default function Logo() {
	return (
		<div className="flex items-center ">
			<Image
				src={logoMob}
				alt="logo"
				className="mr-8 h-40 w-40 lg:h-50 lg:w-50"
			/>
			<div className="text-primaryColor text-16 lg:text-20 font-medium leading-normal text-center">
				<p>Synergia</p>
				<span className="font-bold">CRM</span>
			</div>
		</div>
	);
}
