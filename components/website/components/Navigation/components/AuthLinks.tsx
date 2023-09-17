'use client'
import React from "react";
import { useTranslations } from "next-intl";
import useAuthFormStore from "@/app/store/useAuthFormStore";

export default function AuthLinks() {
	const t = useTranslations("navWebsite.auth");
	const { toggleSignInForm, toggleSignUpForm} = useAuthFormStore ()
	const handleToggleSignin = () => {
		toggleSignInForm()
	}
	const handleToggleSignup = () => {
		toggleSignUpForm ()
	}
	return (
		<ul className="flex items-center sm:justify-between sm:px-20 lg:px-0">
			<li onClick={handleToggleSignin} className="cursor-pointer lg:text-white sm:text-menu sm:text-24 sm:font-medium hover:text-activeMenu lg:text-18">
				{t("signin")}
			</li>
			<li className="mr-10 ml-10 text-white hidden lg:block">|</li>
			<li onClick={handleToggleSignup} className="cursor-pointer lg:text-white sm:text-menu sm:text-24 sm:font-medium hover:text-activeMenu lg:text-18">
				{t("signup")}
			</li>
		</ul>
	);
}
