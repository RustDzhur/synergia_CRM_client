"use client";
import React from "react";
import { MdMenu, MdMoreHoriz } from "react-icons/md";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";

// Figma: на телефоне (375) — «≡», на планшете (768) — «⋯». Активное состояние — синий.
export default function MobileMenu() {
	const { mobileMenu, toggleMobileMenu } = useToggleMenuState();
	const color = mobileMenu ? "#5EA8F5" : "#4D4D4D";

	return (
		<button
			type="button"
			aria-label="Menu"
			aria-expanded={mobileMenu}
			onClick={toggleMobileMenu}
			className="flex cursor-pointer">
			<MdMenu size={30} color={color} className="md:hidden" />
			<MdMoreHoriz size={30} color={color} className="hidden md:block" />
		</button>
	);
}
