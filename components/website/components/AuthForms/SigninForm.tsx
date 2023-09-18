"use client";
import useAuthFormStore from "@/app/store/useAuthFormStore";
import React, { useState } from "react";
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
import { useTranslations } from "next-intl";

interface SignInFormData {
	username: string;
	password: string;
}

export default function SignInForm() {
	const [passwordVisible, setPasswordVisible] = useState(false);
	const {
		isSignInFormOpen,
		isSignUpFormOpen,
		toggleSignInForm,
		toggleSignUpForm,
	} = useAuthFormStore();

    const t = useTranslations("authForms")

	const { handleSubmit, control, watch } = useForm();
	const password = watch("password", "");

	const onSubmit: SubmitHandler<FieldValues> = (data) => {
		const signInData = data as SignInFormData;
		// Handle sign-in logic here
		console.log(signInData);
	};

	const handleChangeForm = () => {
		if (!isSignUpFormOpen && isSignInFormOpen) {
			toggleSignUpForm();
			toggleSignInForm();
		}
	};

	return (
		<>
			<p className="text-34 font-bold text-center leading-[61.2px] sm:mb-20">
				{t("login")}
			</p>
			<form onSubmit={handleSubmit(onSubmit)} className="text-center">
				<div>
					<Controller
						name="username"
						control={control}
						defaultValue=""
						render={({ field }) => (
							<div className="relative">
								<input
									{...field}
									placeholder={t("username")}
									type="text"
									id="username"
									className="pl-50 pr-20 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
								/>
								<div className="absolute top-17 left-20">
									<IconContext.Provider
										value={{ size: "22px", color: "#666666" }}>
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
						render={({ field }) => (
							<div className="relative">
								<input
									{...field}
									placeholder={t("password")}
									type={passwordVisible ? "text" : "password"}
									id="password"
									className="pl-50 pr-50 py-14 w-[100%] rounded-8 shadow-custom border-authFormsUnFocus focus:border-authFormsFocus focus:outline-none mb-18"
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
				</div>
				<div className="text-left text-16 text-menu sm:mb-30 mb-60">
					{t("haveaccount.no")}{" "}
					<span
						className="text-primaryColor cursor-pointer"
						onClick={handleChangeForm}>
						{t("signup")}
					</span>
				</div>
				<div className="">
					<button type="submit" className="sm:px-139 md:px-74 py-15 rounded-4 hover:shadow-authForms bg-authBtn text-18 text-white font-medium">
						{t("login")}
					</button>
				</div>
			</form>
		</>
	);
}
