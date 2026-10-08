"use client";
import "react";
import { useRouter } from "next/navigation";
import { TbArrowUpRight } from "react-icons/tb";
import { useLocale, useTranslations } from "next-intl";
import useAuthFormStore from "@/store/useAuthFormStore";
import { useSiteMenuState } from "@/store/useSiteMenuState";
import DemoButton from "@/components/website/DemoButton";

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
		<ul className="flex items-center gap-16 sm:justify-between sm:px-20 lg:gap-22 lg:px-0">
			<li className="text-16 font-medium text-[#c6ff4d] transition-opacity hover:opacity-80 lg:text-14 lg:tracking-[0.2px]">
				<DemoButton className="flex cursor-pointer items-center gap-6" onDone={() => { if (menu) toggleMenu(); }} />
			</li>
			<li
				onClick={handleToggleSignin}
				className="cursor-pointer text-16 font-medium text-[#8c948b] transition-colors hover:text-[#f1f4ee] lg:text-14 lg:tracking-[0.2px]">
				{t("signin")}
			</li>
			{/* Основное действие шапки — контурная пилюля во всю высоту строки меню */}
			<li
				onClick={handleToggleSignup}
				className="flex cursor-pointer items-center gap-8 rounded-300 border border-[rgba(198,255,77,0.55)] px-20 py-11 text-14 font-semibold text-[#c6ff4d] transition-colors hover:bg-[rgba(198,255,77,0.1)] sm:text-16 lg:py-12 lg:text-14 lg:tracking-[0.2px]">
				{t("signup")}
				<TbArrowUpRight size={16} />
			</li>
		</ul>
	);
}
