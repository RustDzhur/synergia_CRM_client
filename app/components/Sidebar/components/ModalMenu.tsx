"use client";
import { useToggleMenuState } from "@/app/store/store";
import React, { useEffect, useRef } from "react";

export default function ModalMenu() {
	const { mobileMenu,menu, toggleMobileMenu, toggleMenu } = useToggleMenuState();
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
					<div className="bg-white p-20 pt-50 pb-50 rounded-lg shadow-md h-[100vh]">
						ModalMenu
						<button onClick={toggleMobileMenu}>Close Modal</button>
					</div>
				</div>
			) : (
				""
			)}
		</>
	);
}
