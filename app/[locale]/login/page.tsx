"use client";
import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import useAuthFormStore from "@/store/useAuthFormStore";
import SigninForm from "@/components/website/AuthForms/SigninForm";
import SignupForm from "@/components/website/AuthForms/SignupForm";
import VerifyForm from "@/components/website/AuthForms/VerifyForm";

// Страница входа приложения: на crm.firmspace.de маркетинговые пути редиректят сюда (middleware.ts →
// lib/crmHostRedirect.ts), поэтому это отдельная страница без маркетинговой навигации — только вход,
// регистрация и ввод кода подтверждения. Уже вошедшего пользователя ведём сразу в кабинет.
// Формы — те же, что в модалке на маркетинговых страницах (components/website/AuthForms),
// переключение между ними держит useAuthFormStore.
export default function LoginPage() {
	const locale = useLocale();
	const t = useTranslations("login");
	const router = useRouter();
	const { isAuthenticated, authChecked, checkAuth } = useAuthStore();
	const { isSignInFormOpen, isSignUpFormOpen, verifyEmail } = useAuthFormStore();

	useEffect(() => { checkAuth(); }, [checkAuth]);
	// открываем форму входа (если в хранилище осталось состояние от другой страницы — сбрасываем)
	useEffect(() => { useAuthFormStore.getState().openSignInForm(); }, []);
	useEffect(() => {
		if (authChecked && isAuthenticated) router.replace(`/${locale}/crm`);
	}, [authChecked, isAuthenticated, router, locale]);

	return (
		<main className="flex min-h-screen items-center justify-center bg-[#0a0c0b] p-16">
			<div className="w-full max-w-[440px] rounded-16 border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] p-24 sm:p-32">
				<h1 className="mb-16 text-center text-24 font-semibold text-[#f1f4ee]">Firmspace AI</h1>
				{/* Честный статус проекта: плашка пилотной фазы над формой входа (реклама уже идёт) */}
				<div className="mb-20 rounded-10 border border-[rgba(198,255,77,0.35)] bg-[rgba(198,255,77,0.06)] px-12 py-10 text-12 leading-[1.5] text-[#c6ff4d]">
					{t("pilot")}
				</div>
				{verifyEmail ? <VerifyForm email={verifyEmail} /> : isSignUpFormOpen ? <SignupForm /> : isSignInFormOpen ? <SigninForm /> : null}
			</div>
		</main>
	);
}
