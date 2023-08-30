"use client";
import React from "react";
import { AiOutlineMore } from "react-icons/ai";
import { IconContext } from "react-icons";
import { useToggleMenuState } from "@/app/store/store";

export default function MobileMenu() {
	const { mobileMenu, toggleMobileMenu } = useToggleMenuState();

	return (
		<IconContext.Provider
			value={{ size: "30px", color: mobileMenu ? "#5EA8F5" : "#666666" }}>
			<AiOutlineMore
				style={{
					cursor: "pointer",
					transition: "transform 0.25s",
					transform: mobileMenu ? "rotate(90deg)" : "rotate(0deg)",
				}}
				onClick={toggleMobileMenu}
			/>
		</IconContext.Provider>
	);
}
