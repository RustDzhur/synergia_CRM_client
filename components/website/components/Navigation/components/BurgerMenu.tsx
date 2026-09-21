"use client";
import React from "react";
import { AiOutlineClose } from "react-icons/ai";
import { IconContext } from "react-icons";
import { useSiteMenuState } from "@/app/store/useSiteMenuState";
import useAuthFormStore from "@/app/store/useAuthFormStore";

export default function BurgerMenu() {
	const { menu, toggleMenu } = useSiteMenuState();
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
		<div
			onClick={handleCloseModal}
			className={`cursor-pointer transition-transform duration-300 ${menu ? "rotate-90" : ""}`}>
			<IconContext.Provider
				value={{
					size: "30px",
					color: menu ? "#5EA8F5" : "#B3B3B3",
				}}>
				{!menu ? (
					// три штриха 24×22, толщина 4px, цвет #313D45 — как в макете
					<span className="flex h-[22px] w-[24px] flex-col justify-between" aria-hidden="true">
						{[0, 1, 2].map((i) => (
							<span key={i} className="block h-[4px] rounded-[2px] bg-discover" />
						))}
					</span>
				) : (
					<AiOutlineClose />
				)}
			</IconContext.Provider>
		</div>
	);
}
