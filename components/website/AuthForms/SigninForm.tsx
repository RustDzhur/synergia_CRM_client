"use client";
import useAuthFormStore from "@/store/useAuthFormStore";
import { useState } from "react";
import { FaUser } from "react-icons/fa";
import { IoIosLock, IoIosUnlock } from "react-icons/io";
import { BsEyeSlash, BsEye } from "react-icons/bs";
import { IconContext } from "react-icons";
import {
	useForm,
	Controller,
	SubmitHandler,
	FieldValues,
} from "react-hook-form";
import { useTranslations, useLocale } from "next-intl";
import useAuthStore from "@/store/useAuthStore";
import { useSiteMenuState } from "@/store/useSiteMenuState";
import Loader from "@/utils/Loader";
import { checkEmail } from "@/lib/authRules";
import { finishLogin } from "./afterLogin";

interface SignInFormData {
	email: string;
	password: string;
}

export default function SignInForm() {
	const { isLoading, signIn, resendCode } = useAuthStore();
	const [formError, setFormError] = useState("");
	const locale = useLocale();
	const [passwordVisible, setPasswordVisible] = useState(false);
	const {
		isSignInFormOpen,
		isSignUpFormOpen,
		toggleSignInForm,
		toggleSignUpForm,
		openVerify,
	} = useAuthFormStore();
	const { toggleMenu } = useSiteMenuState();

	const t = useTranslations("authForms");

	const { handleSubmit, control, reset } = useForm();

	const onSubmit: SubmitHandler<FieldValues> = async (data) => {
		setFormError("");
		const { email, password } = data as SignInFormData;
		const res = await signIn({ email, password });
		if (!res.ok) {
			// Почта не подтверждена кодом: отправляем новый код и открываем ввод кода
			if (res.code === "email_unverified" && res.email) {
				await resendCode(res.email, locale);
				openVerify(res.email);
				return;
			}
			setFormError(t(`signinError_${["email_required", "email_format", "password_required", "invalid_credentials", "too_many"].includes(res.code) ? res.code : "server"}`));
			return;
		}
		reset();
		toggleSignInForm();
		toggleMenu();
		finishLogin(locale);
	};

	const handleChangeForm = () => {
		if (!isSignUpFormOpen && isSignInFormOpen) {
			toggleSignUpForm();
			toggleSignInForm();
		}
	};

	return (
		<div className="relative">
			<div className="flex items-center justify-center">
				{isLoading && (
					<Loader color="#5EA8F5" width="100" height="20" radius="18" />
				)}
			</div>
			<p className="text-34 font-bold text-center leading-[61.2px] sm:mb-20">
				{t("login")}
			</p>
			<form onSubmit={handleSubmit(onSubmit)} className="text-center" noValidate>
				<div>
					<Controller
						name="email"
						control={control}
						defaultValue=""
						rules={{ validate: (v) => { const r = checkEmail(v); return !r || r.code === "email_typo" ? true : t(r.code === "required" ? "signinError_email_required" : "signinError_email_format"); } }}
						render={({ field, fieldState }) => (
							<div className="relative">
								<input
									{...field}
									placeholder={t("username")}
									type="email"
									id="email"
									className={`pl-50 pr-20 py-14 w-[100%] rounded-8 border bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18 ${fieldState.error ? "border-[#eb5757]" : "border-[rgba(255,255,255,0.14)]"}`}
								/>
								{fieldState.error?.message && <p role="alert" className="-mt-12 mb-14 pl-4 text-left text-12 text-[#eb5757]">{fieldState.error.message}</p>}
								<div className="absolute top-17 left-20">
									<IconContext.Provider
										value={{ size: "22px", color: "#8c948b" }}>
										<FaUser />
									</IconContext.Provider>
								</div>
							</div>
						)}
					/>
				</div>

				<div>
					<Controller
						name="password"
						control={control}
						defaultValue=""
						rules={{ validate: (v) => (String(v ?? "") ? true : t("signinError_password_required")) }}
						render={({ field, fieldState }) => (
							<div className="relative">
								<input
									{...field}
									placeholder={t("password")}
									type={passwordVisible ? "text" : "password"}
									id="password"
									className={`pl-50 pr-50 py-14 w-[100%] rounded-8 border bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18 ${fieldState.error ? "border-[#eb5757]" : "border-[rgba(255,255,255,0.14)]"}`}
								/>
								{fieldState.error?.message && <p role="alert" className="-mt-12 mb-14 pl-4 text-left text-12 text-[#eb5757]">{fieldState.error.message}</p>}
								<div className="absolute top-17 left-20">
									<IconContext.Provider
										value={{ size: "22px", color: "#8c948b" }}>
										{passwordVisible ? <IoIosUnlock /> : <IoIosLock />}
									</IconContext.Provider>
								</div>
								<div
									onClick={() => setPasswordVisible(!passwordVisible)}
									className="absolute top-17 right-20 cursor-pointer">
									<IconContext.Provider
										value={{ size: "22px", color: "#8c948b" }}>
										{passwordVisible ? <BsEye /> : <BsEyeSlash />}
									</IconContext.Provider>
								</div>
							</div>
						)}
					/>
				</div>
				{formError && <p role="alert" className="mb-12 rounded-8 bg-[rgba(235,87,87,0.12)] px-12 py-10 text-left text-14 text-[#ff9b9b]">{formError}</p>}
				<div className="text-left text-16 text-[#8c948b] sm:mb-30 mb-60">
					{t("haveaccount.no")}{" "}
					<span
						className="text-[#c6ff4d] cursor-pointer"
						onClick={handleChangeForm}>
						{t("signup")}
					</span>
				</div>
				<div className="">
					<button
						type="submit"
						disabled={isLoading}
						className="sm:w-full lg:w-[50%] py-15 rounded-4 hover:shadow-authForms bg-authBtn text-18 text-[#0A0A0A] font-medium">
						{t("login")}
					</button>
				</div>
			</form>
		</div>
	);
}
