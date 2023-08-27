"use client";
import React, { useState } from "react";
import { useMediaQuery } from "@react-hook/media-query";
import { AiOutlineMenu, AiOutlineClose } from "react-icons/ai";
import { IconContext } from "react-icons";

export default function BurgerMenu() {
    const isLargeScreen = useMediaQuery("(min-width: 768px)");
	const [isOpen, setIsOpen] = useState(false);
	const handleOpenMenu = () => {
		setIsOpen(!isOpen);
	};
	return (
		<div onClick={handleOpenMenu}>
			<IconContext.Provider value={{ size: isLargeScreen ? "40px" : "30px", color: "#B3B3B3" }}>
				{!isOpen ? <AiOutlineMenu /> : <AiOutlineClose />}
			</IconContext.Provider>
		</div>
	);
}
