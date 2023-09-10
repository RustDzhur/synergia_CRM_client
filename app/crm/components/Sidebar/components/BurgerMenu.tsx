"use client";
import React from "react";
import { RiMenuFoldFill, RiMenuUnfoldFill } from "react-icons/ri";
import { IconContext } from "react-icons";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";

export default function BurgerMenu() {
	const { menu, toggleMenu } = useToggleMenuState();

	return (
		<div onClick={toggleMenu}>
			<IconContext.Provider
				value={{
					size: "20px",
					color: menu ? "#5EA8F5" : "#B3B3B3",
				}}>
				{!menu ? <RiMenuUnfoldFill /> : <RiMenuFoldFill />}
			</IconContext.Provider>
		</div>
	);
}
