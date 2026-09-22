"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import useAuthFormStore from "@/app/store/useAuthFormStore";
import { useSiteMenuState } from "@/app/store/useSiteMenuState";

export default function AuthLinks() {
	const t = useTranslations("navWebsite.auth");
	const locale = useLocale();
	const router = useRouter();
	const { toggleSignInForm, toggleSignUpForm } = useAuthFormStore();
	const { menu, toggleMenu } = useSiteMenuState();

	// Сессия не закончена (в браузере есть токен) — сразу в CRM, а не на форму входа; если токен просрочен,
	// сама CRM (CrmLayout) вернёт на лендинг. Нет токена — как раньше, открываем форму входа.
	const handleToggleSignin = () => {
		let hasToken = false;
		try {
			hasToken = !!localStorage.getItem("token");
		} catch {
			/* приватный режим */
		}
		if (hasToken) {
			if (menu) toggleMenu();
			router.push(`/${locale}/crm`);
			return;
		}
		toggleSignInForm();
		if (!menu) {
			toggleMenu();
		}
	};
	const handleToggleSignup = () => {
		toggleSignUpForm();
		if (!menu) {
			toggleMenu();
		}
	};

	return (
		<ul className="flex items-center sm:justify-between sm:px-20 lg:px-0">
			<li
				onClick={handleToggleSignin}
				className="cursor-pointer lg:text-white sm:text-menu sm:text-24 sm:font-medium hover:text-activeMenu lg:text-18 lg:font-medium lg:tracking-[0.4px]">
				{t("signin")}
			</li>
			<li className="mr-10 ml-10 text-white hidden lg:block">|</li>
			<li
				onClick={handleToggleSignup}
				className="cursor-pointer lg:text-white sm:text-menu sm:text-24 sm:font-medium hover:text-activeMenu lg:text-18 lg:font-medium lg:tracking-[0.4px]">
				{t("signup")}
			</li>
		</ul>
	);
}
