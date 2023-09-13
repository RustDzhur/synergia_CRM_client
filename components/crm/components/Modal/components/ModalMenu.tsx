"use client";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import React, { useEffect, useRef } from "react";
import ModalMobNav from "./ModalMobNav";
import MobileMenu from "../../Header/components/MobileMenu";
import SwitchLanguage from "@/components/crm/components/Modal/components/SwitchLanguage";
import SwitchCompany from "../../Header/components/SwitchCompany";
import CurrentUser from "../../Header/components/CurrentUser";

export default function ModalMenu() {
	const { mobileMenu, menu, toggleMobileMenu, toggleMenu } =
		useToggleMenuState();
	const modalRef = useRef<HTMLDivElement | null>(null);

	const handleCloseModal = (
		event: React.MouseEvent<HTMLDivElement, MouseEvent>
	) => {
		if (modalRef.current && event.target === modalRef.current) {
			toggleMobileMenu();
		}
	};

	useEffect(() => {
		if (mobileMenu) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "auto";
		}
	}, [mobileMenu]);

	useEffect(() => {
		if (mobileMenu && menu) {
			toggleMenu();
		}
	}, [menu, mobileMenu, toggleMenu]);

	return (
		<>
			{mobileMenu ? (
				<div
					ref={modalRef}
					onClick={handleCloseModal}
					className="fixed inset-0 flex items-start justify-end z-50 bg-modalBG">
					<div className="flex sm:bg-secondaryColor md:bg-white md:p-20 md:pt-50 md:pb-50 h-[100vh] sm:w-[100vw] md:w-auto overflow-y-auto">
						<div >
							<div className="md:hidden border-b-switchCompany ">
								<ModalMobNav />
							</div>
							<div>
								<SwitchLanguage />
							</div>
							<div className="flex justify-center sm:mb-30">
								<SwitchCompany />
							</div>
							<div className="md:hidden  sm:flex sm:justify-center ">
								<CurrentUser />
							</div>
							<div className="md:absolute md:top-8 md:right-8">
								<MobileMenu />
							</div>
						</div>
					</div>
				</div>
			) : (
				""
			)}
		</>
	);
}
