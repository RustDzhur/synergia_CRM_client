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

	const lockScroll = () => {
		document.body.style.overflow = "hidden";
	  };
	
	  const unlockScroll = () => {
		document.body.style.overflow = "";
	  };
	
	  React.useEffect(() => {
		if (menu || isSignInFormOpen || isSignUpFormOpen) {
		  lockScroll(); // Call function to lock scroll
		} else {
		  unlockScroll(); // Call function to unlock scroll
		}
	  }, [menu, isSignInFormOpen, isSignUpFormOpen]);

	return (
		<>
			{(menu || isSignInFormOpen || isSignUpFormOpen )&& (
				<div
					ref={modalRef}
					onClick={handleCloseModal}
					className="fixed inset-0 flex justify-start lg:justify-center lg:items-center  z-50 bg-modalBG ">
					<div className=" sm:bg-secondaryColor sm:p-20 w-full lg:h-auto lg:mb-40 lg:rounded-24 lg:w-auto md:w-375 overflow-y-auto">
						<div className="flex justify-between mb-60 lg:mb-20 items-center">
							<div className="lg:hidden">
								<Logo />
							</div>
							{(isSignInFormOpen || isSignUpFormOpen) && (
								<div
									onClick={handleCloseAuthForm}
									className="cursor-pointer lg:hidden">
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
