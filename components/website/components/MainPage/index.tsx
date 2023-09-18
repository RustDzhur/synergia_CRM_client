import React from "react";
import Hero from "./Hero/Hero";
import AboutUs from "./AboutUs/AboutUs";

export default function MainPage() {
	return (
		<div>
			<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg lg:px-100 m-auto px-12">
				<Hero />
			</div>
			<div className="relative sm:bg-aboutUsBackground md:bg-transparent sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg lg:px-100 m-auto ">
				<AboutUs />
				<div className="absolute bg-gradient-background md:w-230 md:h-230 lg:w-303 lg:h-303  z-[-1] bottom-0 left-0 sm:hidden md:block"></div>
			</div>
		</div>
	);
}
