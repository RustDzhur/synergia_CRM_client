"use client";
import React from "react";
import { TbMenu2 } from "react-icons/tb";
import { useToggleMenuState } from "@/store/useToggleMenuState";

// Кнопка разделов на телефоне: сайдбар там скрыт, разделы открываются панелью поверх страницы.
export default function MobileMenu() {
	const { mobileMenu, toggleMobileMenu } = useToggleMenuState();

	return (
		<button
			type="button"
			aria-label="Menu"
			aria-expanded={mobileMenu}
			onClick={toggleMobileMenu}
			className="flex h-34 w-34 items-center justify-center rounded-9 text-[#cfd4cb] transition-colors hover:bg-[rgba(255,255,255,0.06)]">
			<TbMenu2 size={20} />
		</button>
	);
}
