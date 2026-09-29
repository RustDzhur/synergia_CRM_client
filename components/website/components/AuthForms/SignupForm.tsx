"use client";
import { useState } from "react";
import {
	useForm,
	Controller,
	SubmitHandler,
	FieldValues,
} from "react-hook-form";
import { IoIosLock, IoIosUnlock } from "react-icons/io";
import { AiFillBank, AiOutlineMail } from "react-icons/ai";
import { TbReceiptTax } from "react-icons/tb";
import { MdOutlinePersonalInjury } from "react-icons/md";
import { BiSolidBuildingHouse } from "react-icons/bi";
import {
	BsEyeSlash,
	BsEye,
	BsFillTelephoneFill,
	BsFillPersonLinesFill,
	BsFillBuildingsFill,
} from "react-icons/bs";
import { IconContext } from "react-icons";
import useAuthFormStore from "@/store/useAuthFormStore";
import { useTranslations } from "next-intl";
import useAuthStore from "@/store/useAuthStore";

interface SignUpFormData {
	firstname: string;
	lastname: string;
	email: string;
	password: string;
}

function SignupForm() {
	const { isLoading, signUp } = useAuthStore();
	const [activeTab, setActiveTab] = useState("company");
	const [passwordVisible, setPasswordVisible] = useState(false);
	const { handleSubmit, control } = useForm();

    const t = useTranslations("authForms")

	const {
		isSignInFormOpen,
		isSignUpFormOpen,
		toggleSignInForm,
		toggleSignUpForm,
	} = useAuthFormStore();

	const toggleTab = (tab: string) => {
		setActiveTab(tab);
	};

	const onSubmit: SubmitHandler<FieldValues> = async (data) => {
		const { firstname, lastname, email, password } = data as SignUpFormData;
		const success = await signUp({ firstname, lastname, email, password });
		if (success) {
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

	return (
		<div>
			<p className="text-34 font-bold text-center leading-[61.2px] sm:mb-20">
				{t("signup")}
			</p>
			<div className="flex justify-between lg:justify-evenly mb-20">
				<button
					onClick={() => toggleTab("company")}
					className={`${
						activeTab === "company"
							? "bg-authBtn text-[#0A0A0A]"
							: "text-[#c6ff4d]"
					} border border-authTabBtn px-20 py-14 rounded-8 flex items-center`}>
					<div className="mr-8">
						<IconContext.Provider
							value={{
								size: "22px",
								color: `${activeTab === "company" ? "#0A0A0A" : "#c6ff4d"}`,
							}}>
							<BsFillBuildingsFill />
						</IconContext.Provider>
					</div>
					<p>{t("companyTab")}</p>
				</button>
				<button
					onClick={() => toggleTab("personal")}
					className={`${
						activeTab === "personal"
							? "bg-authBtn text-[#0A0A0A]"
							: "text-[#c6ff4d]"
					} border border-authTabBtn px-20 py-14 rounded-8 flex items-center`}>
					<div className="mr-8">
						<IconContext.Provider
							value={{
								size: "22px",
								color: `${activeTab === "personal" ? "#0A0A0A" : "#c6ff4d"}`,
							}}>
							<MdOutlinePersonalInjury />
						</IconContext.Provider>
					</div>
					<p>{t("personalTab")}</p>
				</button>
			</div>
			<form onSubmit={handleSubmit(onSubmit)} className="text-center">
				{activeTab === "company" ? (
					<div className="mb-15 lg:grid lg:grid-cols-2 lg:gap-6">
						<Controller
							name="companyName"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t('companyname')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<AiFillBank />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="taxNumber"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t('taxnumber')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<TbReceiptTax />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="companyPhone"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t("companyphone")}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<BsFillTelephoneFill />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="companyEmail"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="email"
										placeholder={t("companyemail")}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<AiOutlineMail />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="companyAddress"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t("companyaddress")}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<BiSolidBuildingHouse />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="companyPassword"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="password"
										placeholder={t("companypassword")}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
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

						<Controller
							name="companyAgreement"
							control={control}
							render={({ field }) => (
								<div className="text-left">
									<label>
										<input {...field} type="checkbox" className="mr-8" />
										<span className="text-16 font-normal text-[#8c948b]">
                                        {t('agreement')}
										</span>
									</label>
								</div>
							)}
						/>
					</div>
				) : (
					<div className="mb-15 lg:grid lg:grid-cols-2 lg:gap-6">
						<Controller
							name="firstname"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t('firstname')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<BsFillPersonLinesFill />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="lastname"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t('lastname')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<BsFillPersonLinesFill />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="phone"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t('personalphone')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<BsFillTelephoneFill />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="email"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="email"
										placeholder={t('personalemail')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<AiOutlineMail />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="personalAddress"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t("personaladdress")}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#8c948b" }}>
											<BiSolidBuildingHouse />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="password"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="password"
										placeholder={t('personalpassword')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[#f1f4ee] placeholder:text-[#8c948b] outline-none transition-colors focus:border-[rgba(198,255,77,0.55)] mb-18"
									/>
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

						<Controller
							name="personalAgreement"
							control={control}
							render={({ field }) => (
								<div className="text-left">
									<label>
										<input {...field} type="checkbox" className="mr-8" />
										<span className="text-16 font-normal text-[#8c948b]">
											{t('agreement')}
										</span>
									</label>
								</div>
							)}
						/>
					</div>
				)}
				<div className="text-left text-16 text-[#8c948b] sm:mb-30 mb-40">
					{t('haveaccount.yes')}{" "}
					<span
						className="text-[#c6ff4d] cursor-pointer"
						onClick={handleChangeForm}>
						{t('login')}
					</span>
				</div>
				<button
					type="submit"
					disabled={isLoading}
					className="sm:w-full lg:w-[50%] py-15 rounded-4 hover:shadow-authForms bg-authBtn text-18 text-[#0A0A0A] font-medium">
					{t('signup')}
				</button>
			</form>
		</div>
	);
}

export default SignupForm;
