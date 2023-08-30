"use client";
import { useToggleMenuState } from "@/app/store/store";
import React, { useEffect, useRef } from "react";
import ModalMobNav from "./ModalMobNav";
import MobileMenu from "../../Header/components/MobileMenu";
import SwitchLanguage from "../../Header/components/SwitchLanguage";
import SwitchCompany from "../../Header/components/SwitchCompany";

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
					<div className="flex bg-white md:p-20 md:pt-50 md:pb-50 h-[100vh] sm:w-[100vw] md:w-auto">
						<div className="flex flex-col justify-start items-start">
							<div className="md:hidden">
								<ModalMobNav />
							</div>
							{/* <div className="flex justify-between">
								<p>Language</p>
								<SwitchLanguage />
							</div> */}
							<div>
								<SwitchCompany />
							</div>
							<div className="absolute top-8 right-8">
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
