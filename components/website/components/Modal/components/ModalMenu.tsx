"use client";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import React, { useRef } from "react";
import ModalNav from "./ModalNav";
import SwitchLanguage from "./SwitchLanguages";
import AuthLinks from "../../Navigation/components/AuthLinks";
import Logo from "../../Navigation/components/Logo";
import BurgerMenu from "../../Navigation/components/BurgerMenu";
import useAuthFormStore from "@/app/store/useAuthFormStore";
import { RiArrowGoBackFill } from "react-icons/ri";
import { IconContext } from "react-icons";
import { SigninForm, SignupForm } from "../../AuthForms";

export default function ModalMenu() {
	const { menu, toggleMenu } = useToggleMenuState();
	const modalRef = useRef<HTMLDivElement | null>(null);
	const {
		isSignInFormOpen,
		isSignUpFormOpen,
		toggleSignInForm,
		toggleSignUpForm,
	} = useAuthFormStore();

	const handleCloseModal = (
		event: React.MouseEvent<HTMLDivElement, MouseEvent>
	) => {
		if (modalRef.current && event.target === modalRef.current) {
			toggleMenu();
            handleCloseAuthForm();
		}
	};

	const handleCloseAuthForm = () => {
		if (isSignInFormOpen) {
			toggleSignInForm();
		} else if (isSignUpFormOpen) {
			toggleSignUpForm();
		}
	};

	return (
		<>
			{menu && (
				<div
					ref={modalRef}
					onClick={handleCloseModal}
					className="fixed inset-0 flex items-center justify-start z-50 bg-modalBG">
					<div className=" sm:bg-secondaryColor sm:p-20 h-[100vh] sm:w-[100vw] md:w-320 overflow-y-auto">
						<div className="flex justify-between mb-60 items-center">
							<Logo />
							{(isSignInFormOpen || isSignUpFormOpen) && (
								<div onClick={handleCloseAuthForm} className="cursor-pointer">
									<IconContext.Provider
										value={{ size: "30px", color: "#cccccc" }}>
										<RiArrowGoBackFill />
									</IconContext.Provider>
								</div>
							)}

							<BurgerMenu />
						</div>
						{isSignInFormOpen && !isSignUpFormOpen && (
							<div className="mb-30">
								<SigninForm />
							</div>
						)}
						{isSignUpFormOpen && !isSignInFormOpen && (
							<div className="mb-30">
								<SignupForm />
							</div>
						)}
						{!isSignInFormOpen && !isSignUpFormOpen && (
							<>
								<div className="mb-30">
									<ModalNav />
								</div>
								<div className="mb-60">
									<SwitchLanguage />
								</div>
								<AuthLinks />
							</>
						)}
					</div>
				</div>
			)}
		</>
	);
}
