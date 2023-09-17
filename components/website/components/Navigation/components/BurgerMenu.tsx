"use client";
import React from "react";
import { AiOutlineMenu, AiOutlineClose } from "react-icons/ai";
import { IconContext } from "react-icons";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import useAuthFormStore from "@/app/store/useAuthFormStore";

export default function BurgerMenu() {
	const { menu, toggleMenu } = useToggleMenuState();
	const {
		isSignInFormOpen,
		isSignUpFormOpen,
		toggleSignInForm,
		toggleSignUpForm,
	} = useAuthFormStore();
	
	const handleCloseModal = () => {
		toggleMenu();
		handleCloseAuthForm();
	};

	const handleCloseAuthForm = () => {
		if (isSignInFormOpen) {
			toggleSignInForm();
		} else if (isSignUpFormOpen) {
			toggleSignUpForm();
		}
	};
	return (
		<div onClick={handleCloseModal}>
			<IconContext.Provider
				value={{
					size: "30px",
					color: menu ? "#5EA8F5" : "#B3B3B3",
				}}>
				{!menu ? <AiOutlineMenu /> : <AiOutlineClose />}
			</IconContext.Provider>
		</div>
	);
}
