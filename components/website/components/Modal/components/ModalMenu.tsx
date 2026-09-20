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
import { usePresence } from "@/app/utils/usePresence";

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
		document.documentElement.style.overflow = 'hidden';
		document.body.style.overflow = 'hidden';
	  };
	
	  const unlockScroll = () => {
		document.documentElement.style.overflow = '';
		document.body.style.overflow = '';
	  };
	
	  React.useEffect(() => {
		if (menu || isSignInFormOpen || isSignUpFormOpen) {
		  lockScroll();
		} else {
		  unlockScroll();
		}
	  }, [menu, isSignInFormOpen, isSignUpFormOpen]);

	const open = menu || isSignInFormOpen || isSignUpFormOpen;
	// панель остаётся в DOM на время анимации закрытия
	const { rendered, visible } = usePresence(open, 300);
	// запоминаем, что показывали, пока модалка открыта — иначе при закрытии
	// содержимое на секунду «переключается» на меню, пока панель гаснет
	const viewRef = useRef<"nav" | "signin" | "signup">("nav");
	if (open) {
		viewRef.current =
			isSignInFormOpen && !isSignUpFormOpen ? "signin" : isSignUpFormOpen && !isSignInFormOpen ? "signup" : "nav";
	}
	const view = viewRef.current;

	return (
		<>
			{rendered && (
				<div
					ref={modalRef}
					onClick={handleCloseModal}
					className={`fixed inset-0 flex justify-start lg:justify-center lg:items-center  z-50 bg-modalBG transition-opacity duration-300 motion-reduce:transition-none ${
						visible ? "opacity-100" : "opacity-0"
					}`}>
					<div
						className={` sm:bg-secondaryColor sm:p-20 w-full lg:h-auto lg:mb-40 lg:rounded-24 lg:w-auto md:w-375  overflow-y-auto scroll-hide-scrollbar transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
							visible ? "translate-y-0 opacity-100" : "-translate-y-[16px] opacity-0"
						}`}>
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
						{view === "signin" && (
							<div key="signin" className="mb-30 animate-fade-in">
								<SigninForm />
							</div>
						)}
						{view === "signup" && (
							<div key="signup" className="mb-30 animate-fade-in">
								<SignupForm />
							</div>
						)}
						{view === "nav" && (
							<div key="nav" className="animate-fade-in">
								<div className="mb-30">
									<ModalNav />
								</div>
								<div className="mb-60">
									<SwitchLanguage />
								</div>
								<AuthLinks />
							</div>
						)}
					</div>
				</div>
			)}
		</>
	);
}
