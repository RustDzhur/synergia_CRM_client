"use client";
import React from "react";
import { AiOutlineMenu, AiOutlineClose } from "react-icons/ai";
import { IconContext } from "react-icons";

export default function BurgerMenu() {
	return (
		<IconContext.Provider value={{ size: "30px" }}>
			<AiOutlineMenu />
		</IconContext.Provider>
	);
}
