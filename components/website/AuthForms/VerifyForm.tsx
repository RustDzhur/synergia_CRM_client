"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import useAuthStore from "@/store/useAuthStore";
import useAuthFormStore from "@/store/useAuthFormStore";
import { useSiteMenuState } from "@/store/useSiteMenuState";
import { finishLogin } from "./afterLogin";

const RESEND_SECONDS = 60;
const KNOWN = ["code_format", "code_wrong", "code_expired", "attempts", "code_attempts", "too_many", "wait", "email_required"];

// Шаг подтверждения почты: человек вводит 6-значный код из письма — только после этого аккаунт открывается
export default function VerifyForm({ email }: { email: string }) {
	const t = useTranslations("authForms");
	const locale = useLocale();
	const { isLoading, verifyEmail, resendCode } = useAuthStore();
	const { toggleSignInForm, openSignUpForm } = useAuthFormStore();
	const { toggleMenu } = useSiteMenuState();
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [wait, setWait] = useState(RESEND_SECONDS);

	useEffect(() => {
		if (wait <= 0) return;
		const id = setTimeout(() => setWait((w) => w - 1), 1000);
		return () => clearTimeout(id);
	}, [wait]);

	const message = (c: string) => t(`verifyError_${KNOWN.includes(c) ? (c === "attempts" ? "code_attempts" : c) : "server"}`);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const res = await verifyEmail(email, code);
		if (!res.ok) return setError(message(res.code));
		toast.success(t("verifySuccess"));
		toggleSignInForm();
		toggleMenu();
		finishLogin(locale);
	}

	async function resend() {
		setError("");
		const res = await resendCode(email, locale);
		if (!res.ok) return setError(message(res.code));
		setCode("");
		setWait(RESEND_SECONDS);
		toast.success(t("verifyResent"));
	}

	return (
		<div>
			<p className="text-30 font-bold text-center leading-[44px] sm:mb-12">{t("verifyTitle")}</p>
			<p className="mb-20 text-center text-15 leading-[22px] text-[#d8ddd5]">{t("verifyText", { email })}</p>
			<form onSubmit={submit} className="text-center">
				<input
					value={code}
					onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
					inputMode="numeric"
					autoComplete="one-time-code"
					autoFocus
					placeholder={t("verifyPlaceholder")}
					aria-label={t("verifyPlaceholder")}
					className={`w-[100%] rounded-8 border bg-[rgba(255,255,255,0.04)] px-20 py-14 text-center text-28 tracking-[0.5em] text-[#f1f4ee] outline-none transition-colors placeholder:text-16 placeholder:tracking-normal placeholder:text-[#8c948b] focus:border-[rgba(198,255,77,0.55)] ${error ? "border-[#eb5757]" : "border-[rgba(255,255,255,0.14)]"}`}
				/>
				{error && <p role="alert" className="mt-8 text-left text-13 text-[#eb5757]">{error}</p>}
				<p className="mt-8 text-left text-12 text-[#8c948b]">{t("verifySpam")}</p>
				<button
					type="submit"
					disabled={isLoading || code.length !== 6}
					className="mt-20 w-full rounded-4 bg-authBtn py-15 text-18 font-medium text-[#0A0A0A] hover:shadow-authForms disabled:opacity-50">
					{t("verifyButton")}
				</button>
			</form>
			<div className="mt-16 flex flex-wrap items-center justify-between gap-8 text-14">
				<button type="button" onClick={resend} disabled={wait > 0} className="text-[#c6ff4d] disabled:text-[#8c948b]">
					{wait > 0 ? t("verifyResendIn", { sec: wait }) : t("verifyResend")}
				</button>
				<button type="button" onClick={openSignUpForm} className="text-[#8c948b] hover:text-[#c6ff4d]">{t("verifyWrongEmail")}</button>
			</div>
		</div>
	);
}
