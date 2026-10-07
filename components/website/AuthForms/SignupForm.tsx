"use client";
import { useState } from "react";
import { useForm, Controller, SubmitHandler, FieldValues } from "react-hook-form";
import useAuthFormStore from "@/store/useAuthFormStore";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import useAuthStore from "@/store/useAuthStore";
import { checkAddress, checkEmail, checkName, checkPassword, checkPhone, checkTax, type RuleResult } from "@/lib/authRules";
import SignupField from "./signupParts/SignupField";
import SignupTabs from "./signupParts/SignupTabs";
import { COMPANY_FIELDS, PERSONAL_FIELDS, SignupTab } from "./signupParts/model";
import { signupPayload } from "./signupParts/payload";

// Правила полей (lib/authRules — те же проверяет сервер). Обязательны имя/название, почта, пароль и согласие; телефон, налоговый номер и адрес — по желанию
const RULES: Record<string, (v: unknown) => RuleResult | null> = {
	companyName: checkName, firstname: checkName, lastname: checkName,
	companyEmail: checkEmail, email: checkEmail,
	companyPassword: checkPassword, password: checkPassword,
	companyPhone: checkPhone, phone: checkPhone, taxNumber: checkTax,
	companyAddress: checkAddress, personalAddress: checkAddress,
};
// Какое поле формы соответствует названию поля в ответе сервера (для текста «Укажите …»)
const SERVER_FIELD: Record<string, { company: string; personal: string }> = {
	companyName: { company: "companyname", personal: "firstname" }, firstname: { company: "companyname", personal: "firstname" },
	lastname: { company: "companyname", personal: "lastname" }, email: { company: "companyemail", personal: "personalemail" },
	password: { company: "companypassword", personal: "personalpassword" }, phone: { company: "companyphone", personal: "personalphone" },
	taxNumber: { company: "taxnumber", personal: "taxnumber" }, address: { company: "companyaddress", personal: "personaladdress" },
};

function SignupForm() {
	const { isLoading, signUp } = useAuthStore();
	const [activeTab, setActiveTab] = useState<SignupTab>("company");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const [agreementError, setAgreementError] = useState(false);
	const { handleSubmit, control, setError: setFieldError } = useForm({ mode: "onBlur", reValidateMode: "onChange" });

	const t = useTranslations("authForms");
	const locale = useLocale();

	const { isSignInFormOpen, isSignUpFormOpen, toggleSignInForm, toggleSignUpForm, openVerify } = useAuthFormStore();

	// Текст ошибки поля: «<название поля>» подставляется в сообщение, числа (минимум символов и т.п.) — из правила
	const ruleText = (rule: RuleResult, label: string) => t(`v_${rule.code}`, { field: label, ...rule.params });
	const validatorFor = (name: string, label: string) => (value: unknown): string | true => {
		const r = RULES[name]?.(value);
		return r ? ruleText(r, label) : true;
	};

	const onSubmit: SubmitHandler<FieldValues> = async (data) => {
		const agreed = !!(activeTab === "company" ? data.companyAgreement : data.personalAgreement);
		setAgreementError(!agreed);
		if (!agreed) return;
		const hp = (document.getElementById("signup-website") as HTMLInputElement | null)?.value ?? "";
		const res = await signUp({ ...signupPayload(activeTab, data), locale, website: hp });
		if (!res.ok) {
			// Сервер назвал поле и правило — показываем то же сообщение, что и под полем; иначе общая причина
			const map = res.field ? SERVER_FIELD[res.field] : undefined;
			if (map && !["email_taken", "mail_failed", "too_many"].includes(res.code)) {
				toast.error(t(`v_${res.code}`, { field: t(map[activeTab]), ...(res.params ?? {}) }));
				return;
			}
			if (res.code === "email_taken") {
				setFieldError(activeTab === "company" ? "companyEmail" : "email", { message: t("signupError_email_taken") });
				toast.error(t("signupError_email_taken"));
				return;
			}
			toast.error(t(`signupError_${["mail_failed", "too_many"].includes(res.code) ? res.code : "generic"}`));
			return;
		}
		if (res.verify && res.email) {
			openVerify(res.email); // на почту ушёл код — следующий шаг: ввести его
			return;
		}
		toast.success(t("signupSuccess"));
		toggleSignUpForm();
		toggleSignInForm(); // открыть форму входа
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
			<form onSubmit={handleSubmit(onSubmit, () => toast.error(t("signupError_fill")))} className="text-center" noValidate>
				{/* ловушка для ботов: скрытое поле, человек его не заполняет */}
				<input id="signup-website" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
				<div key={activeTab} className="mb-15 lg:grid lg:grid-cols-2 lg:gap-6">
					{fields.map((f) => (
						<SignupField
							key={f.name}
							field={f}
							placeholder={t(f.label)}
							control={control}
							passwordVisible={passwordVisible}
							hint={f.type === "password" ? t("passwordHint") : OPTIONAL.includes(f.name) ? t("optionalHint") : undefined}
							validate={validatorFor(f.name, t(f.label))}
							onTogglePassword={() => setPasswordVisible(!passwordVisible)}
						/>
					))}
					<Controller
						name={activeTab === "company" ? "companyAgreement" : "personalAgreement"}
						control={control}
						defaultValue={false}
						render={({ field }) => (
							<div className="text-left">
								<label>
									<input type="checkbox" className="mr-8" checked={!!field.value} onChange={(e) => { field.onChange(e.target.checked); if (e.target.checked) setAgreementError(false); }} />
									<span className="text-16 font-normal text-[#8c948b]">{t("agreement")}</span>
								</label>
								{agreementError && <p role="alert" className="mt-4 text-12 text-[#eb5757]">{t("v_agreement")}</p>}
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

// поля, которые можно не заполнять: под ними подсказка «по желанию»
const OPTIONAL = ["taxNumber", "companyPhone", "companyAddress", "phone", "personalAddress"];

export default SignupForm;
