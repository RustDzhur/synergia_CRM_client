"use client";
import React from "react";
import { AiOutlineMenu, AiOutlineClose } from "react-icons/ai";
import { IconContext } from "react-icons";
import { useToggleMenuState } from "@/app/store/store";

export default function BurgerMenu() {
	const {menu, toggleMenu} = useToggleMenuState()

	return (
		<div onClick={toggleMenu}>
			<IconContext.Provider
				value={{
					size: "30px",
					color: "#B3B3B3",
				}}>
				{!menu ? <AiOutlineMenu /> : <AiOutlineClose />}
			</IconContext.Provider>
		</div>
	);
}
