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
		<ul className="flex items-center gap-16 sm:justify-between sm:px-20 lg:gap-20 lg:px-0">
			<li
				onClick={handleToggleSignin}
				className="cursor-pointer lg:text-white sm:text-menu sm:text-16 sm:font-medium hover:text-accentGreen lg:text-15 lg:font-medium lg:tracking-[0.3px]">
				{t("signin")}
			</li>
			<li
				onClick={handleToggleSignup}
				className="cursor-pointer rounded-300 border border-accentGreen px-18 py-8 text-14 font-medium text-accentGreen transition-colors hover:bg-[rgba(198,255,77,0.1)] sm:text-16 lg:text-15 lg:tracking-[0.3px]">
				{t("signup")}
			</li>
		</ul>
	);
}
