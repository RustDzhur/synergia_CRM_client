import Image from "next/image";
import React from "react";
import BurgerMenu from "./components/BurgerMenu";
import NavLinks from "./components/NavLinks";
import AuthLinks from "./components/AuthLinks";
import Logo from "./components/Logo";

export default function Navigation() {
	return (
		<div className="relative sm:pr-12 sm:pl-12 sm:pt-20 sm:pb-20 md:pr-20 md:pl-20 lg:pr-100 lg:pl-100 lg:pt-30 lg:pb-30">
			<div className="absolute bg-gradient-background sm:w-300 sm:h-300 md:w-800 md:h-800 sm:rounded-300 md:rounded-800 z-[-1] sm:top-[-142px] sm:right-[-116px] md:top-[-420px] md:right-[-437px] lg:right-[-400px] lg:top-[-149px]"></div>
			<div className="flex justify-between items-center">
				<Logo />

				<div className="lg:hidden">
					<BurgerMenu />
				</div>
				<div className="hidden lg:flex">
					<NavLinks />
				</div>
				<div className="hidden lg:flex">
					<AuthLinks />
				</div>
			</div>
		</div>
	);
}
