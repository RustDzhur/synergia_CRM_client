"use client";
import { useState } from "react";
import { useForm, Controller, SubmitHandler, FieldValues } from "react-hook-form";
import useAuthFormStore from "@/store/useAuthFormStore";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import useAuthStore from "@/store/useAuthStore";
import SignupField from "./signupParts/SignupField";
import SignupTabs from "./signupParts/SignupTabs";
import { COMPANY_FIELDS, PERSONAL_FIELDS, SignupTab } from "./signupParts/model";
import { signupPayload } from "./signupParts/payload";

function SignupForm() {
	const { isLoading, signUp } = useAuthStore();
	const [activeTab, setActiveTab] = useState<SignupTab>("company");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const { handleSubmit, control } = useForm();

	const t = useTranslations("authForms");

	const { isSignInFormOpen, isSignUpFormOpen, toggleSignInForm, toggleSignUpForm } = useAuthFormStore();

	const onSubmit: SubmitHandler<FieldValues> = async (data) => {
		const res = await signUp(signupPayload(activeTab, data));
		if (!res.ok) {
			toast.error(t(`signupError_${["name_required", "email_invalid", "password_short", "email_taken"].includes(res.code) ? res.code : "generic"}`));
			return;
		}
		toast.success(t("signupSuccess"));
		{
			toggleSignUpForm();
			toggleSignInForm(); // открыть форму входа
		}
	};

	const handleChangeForm = () => {
		if (isSignUpFormOpen && !isSignInFormOpen) {
			toggleSignUpForm();
			toggleSignInForm();
		}
	};

	const fields = activeTab === "company" ? COMPANY_FIELDS : PERSONAL_FIELDS;

	return (
		<div>
			<p className="text-34 font-bold text-center leading-[61.2px] sm:mb-20">{t("signup")}</p>
			<SignupTabs active={activeTab} onChange={setActiveTab} label={(key) => t(key)} />
			<form onSubmit={handleSubmit(onSubmit, () => toast.error(t("signupError_fill")))} className="text-center">
				<div key={activeTab} className="mb-15 lg:grid lg:grid-cols-2 lg:gap-6">
					{fields.map((f) => (
						<SignupField
							key={f.name}
							field={f}
							placeholder={t(f.label)}
							control={control}
							passwordVisible={passwordVisible}
							hint={f.type === "password" ? t("passwordHint") : undefined}
							onTogglePassword={() => setPasswordVisible(!passwordVisible)}
						/>
					))}
					<Controller
						name={activeTab === "company" ? "companyAgreement" : "personalAgreement"}
						control={control}
						render={({ field }) => (
							<div className="text-left">
								<label>
									<input {...field} type="checkbox" className="mr-8" />
									<span className="text-16 font-normal text-[#8c948b]">{t("agreement")}</span>
								</label>
							</div>
						)}
					/>
				</div>
				<div className="text-left text-16 text-[#8c948b] sm:mb-30 mb-40">
					{t("haveaccount.yes")}{" "}
					<span className="text-[#c6ff4d] cursor-pointer" onClick={handleChangeForm}>
						{t("login")}
					</span>
				</div>
				<button
					type="submit"
					disabled={isLoading}
					className="sm:w-full lg:w-[50%] py-15 rounded-4 hover:shadow-authForms bg-authBtn text-18 text-[#0A0A0A] font-medium">
					{t("signup")}
				</button>
			</form>
		</div>
	);
}

export default SignupForm;
