"use client";
import React from "react";
import { MdMenu } from "react-icons/md";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";

interface Props {
	size?: number;
}

// Кнопка сворачивания/разворачивания сайдбара. В Figma это серый значок «≡» 40×40 слева в шапке.
export default function BurgerMenu({ size = 40 }: Props) {
	const toggleMenu = useToggleMenuState((state) => state.toggleMenu);

	return (
		<button type="button" aria-label="Toggle menu" onClick={toggleMenu} className="flex">
			<MdMenu size={size} color="#B3B3B3" />
		</button>
	);
}
