"use client";
import React, { useState } from "react";
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
import useAuthFormStore from "@/app/store/useAuthFormStore";
import { useTranslations } from "next-intl";

interface SignUpFormData {
	username: string;
	password: string;
}

function SignupForm() {
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

	const onSubmit: SubmitHandler<FieldValues> = (data) => {
		const signInData = data as SignUpFormData;
		// Handle sign-in logic here
		console.log(signInData);
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
							? "bg-authBtn text-white"
							: "#ffffff text-menu"
					} px-20 py-14 rounded-8 border-authTabBtn flex items-center`}>
					<div className="mr-8">
						<IconContext.Provider
							value={{
								size: "22px",
								color: `${activeTab === "company" ? "#fff" : "#ccc"}`,
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
							? "bg-authBtn text-white"
							: "#ffffff text-menu"
					} px-20 py-14 rounded-8 border-authTabBtn flex items-center`}>
					<div className="mr-8">
						<IconContext.Provider
							value={{
								size: "22px",
								color: `${activeTab === "personal" ? "#fff" : "#ccc"}`,
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
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
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
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
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
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
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
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
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
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
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
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
											{passwordVisible ? <IoIosUnlock /> : <IoIosLock />}
										</IconContext.Provider>
									</div>
									<div
										onClick={() => setPasswordVisible(!passwordVisible)}
										className="absolute top-17 right-20 cursor-pointer">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
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
										<span className="text-16 font-normal text-menu">
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
							name="firstName"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t('firstname')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
											<BsFillPersonLinesFill />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="lastName"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t('lastname')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
											<BsFillPersonLinesFill />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="personalPhone"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="text"
										placeholder={t('personalphone')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
											<BsFillTelephoneFill />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="personalEmail"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="email"
										placeholder={t('personalemail')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
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
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
											<BiSolidBuildingHouse />
										</IconContext.Provider>
									</div>
								</div>
							)}
						/>

						<Controller
							name="personalPassword"
							control={control}
							rules={{ required: true }}
							render={({ field }) => (
								<div className="relative">
									<input
										{...field}
										type="password"
										placeholder={t('personalpassword')}
										className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
									/>
									<div className="absolute top-17 left-20">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
											{passwordVisible ? <IoIosUnlock /> : <IoIosLock />}
										</IconContext.Provider>
									</div>
									<div
										onClick={() => setPasswordVisible(!passwordVisible)}
										className="absolute top-17 right-20 cursor-pointer">
										<IconContext.Provider
											value={{ size: "22px", color: "#666666" }}>
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
										<span className="text-16 font-normal text-menu">
											{t('agreement')}
										</span>
									</label>
								</div>
							)}
						/>
					</div>
				)}
				<div className="text-left text-16 text-menu sm:mb-30 mb-40">
					{t('haveaccount.yes')}{" "}
					<span
						className="text-primaryColor cursor-pointer"
						onClick={handleChangeForm}>
						{t('login')}
					</span>
				</div>
				<button
					type="submit"
					className="sm:w-full lg:w-[50%] py-15 rounded-4 hover:shadow-authForms bg-authBtn text-18 text-white font-medium">
					{t('signup')}
				</button>
			</form>
		</div>
	);
}

export default SignupForm;
