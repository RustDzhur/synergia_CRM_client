import React from "react";
import BurgerMenu from "./components/BurgerMenu";
import NavLinks from "./components/NavLinks";
import AuthLinks from "./components/AuthLinks";
import Logo from "./components/Logo";
import ModalMenu from "../Modal/components/ModalMenu";
import ChatWidget from "../ChatWidget";

export default function Navigation() {
	return (
		<div className="relative sm:pl-12 sm:pr-12 sm:pt-20 sm:pb-20 md:pl-20 md:pr-20 lg:px-100 lg:pb-30 lg:pt-22">
			<div className="flex items-center justify-between gap-20">
				<Logo />

				<div className="lg:hidden">
					<BurgerMenu />
				</div>
				<div className="hidden lg:flex">
					<NavLinks />
				</div>
				<div className="hidden lg:flex">
					<AuthLinks />
				</div>
				<div className="absolute">
					<ModalMenu/>
				</div>
			</div>
			{/* Чат посетителя: навигация есть на всех публичных страницах, а в кабинете её нет —
			    поэтому виджет подключается отсюда и в CRM не попадает */}
			<ChatWidget />
		</div>
	);
}
