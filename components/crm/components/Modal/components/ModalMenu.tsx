"use client";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import { useScrollLock } from "@/app/utils/useScrollLock";
import React, { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import ModalMobNav from "./ModalMobNav";
import MobileMenu from "../../Header/components/MobileMenu";
import SwitchLanguage from "@/components/crm/components/Modal/components/SwitchLanguage";
import SwitchCompany from "../../Header/components/SwitchCompany";
import CurrentUser from "../../Header/components/CurrentUser";
import Notification from "../../Header/components/Notification";

// < 768px: панель на весь экран под шапкой (шапка с «≡» остаётся видимой и закрывает меню),
//          плавно выезжает сверху.
// ≥ 768px: боковая панель справа поверх страницы, плавно выезжает справа, крестик внутри неё.
// Панель всегда в DOM — так анимируется не только открытие, но и закрытие.
export default function ModalMenu() {
	const { mobileMenu, menu, toggleMobileMenu, toggleMenu } = useToggleMenuState();
	const modalRef = useRef<HTMLDivElement | null>(null);
	const t = useTranslations("navBar");

	const handleCloseModal = (
		event: React.MouseEvent<HTMLDivElement, MouseEvent>
	) => {
		if (modalRef.current && event.target === modalRef.current) {
			toggleMobileMenu();
		}
	};

	useScrollLock(mobileMenu);

	useEffect(() => {
		if (mobileMenu && menu) {
			toggleMenu();
		}
	}, [menu, mobileMenu, toggleMenu]);

	return (
		<div
			ref={modalRef}
			onClick={handleCloseModal}
			aria-hidden={!mobileMenu}
			className={`fixed inset-x-0 bottom-0 top-[82px] md:inset-0 z-50 flex items-start justify-end bg-modalBG transition-[opacity,visibility] duration-300 motion-reduce:transition-none ${
				mobileMenu ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"
			}`}>
			<div
				className={`relative h-full w-full md:w-auto overflow-y-auto bg-secondaryColor md:bg-white md:p-20 md:pt-50 md:pb-50 transition-transform duration-300 ease-out motion-reduce:transition-none ${
					mobileMenu
						? "translate-y-0 md:translate-x-0"
						: "-translate-y-[16px] md:translate-y-0 md:translate-x-full"
				}`}>
				<div className="md:hidden">
					<ModalMobNav />
					<div className="border-t-switchCompany pt-[11px]">
						<SwitchLanguage />
						<div className="flex items-center justify-between h-[55px] px-12">
							<p className="text-18 font-medium text-iconColor">{t("notifications")}</p>
							<Notification />
						</div>
					</div>
					<div className="px-12 py-[11px]">
						<SwitchCompany />
					</div>
					<div className="px-12 py-[11px]">
						<CurrentUser showAvatar />
					</div>
				</div>
				<div className="hidden md:block">
					<SwitchLanguage />
					<div className="flex justify-center mb-30">
						<SwitchCompany />
					</div>
				</div>
				<div className="hidden md:block md:absolute md:top-8 md:right-8">
					<MobileMenu />
				</div>
			</div>
		</div>
	);
}
