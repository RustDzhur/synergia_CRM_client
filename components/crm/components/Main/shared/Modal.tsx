"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "@/app/utils/usePresence";

interface Props {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	// классы панели (ширина, отступы, скругления)
	className?: string;
	// выравнивание по вертикали: по центру или сверху с отступом (большие окна)
	align?: "center" | "top";
	label?: string;
	zIndex?: number;
}

// Окно поверх страницы: тёмная подложка, плавное появление и исчезновение, закрытие по Escape и клику
// мимо. Содержимое размонтируется после анимации закрытия, поэтому формы внутри каждый раз «чистые».
export default function Modal({ open, onClose, children, className = "", align = "center", label, zIndex = 60 }: Props) {
	const { rendered, visible } = usePresence(open, 300);
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [open, onClose]);

	if (!mounted || !rendered) return null;

	return createPortal(
		<div
			onMouseDown={(e) => e.target === e.currentTarget && onClose()}
			style={{ zIndex }}
			className={`fixed inset-0 flex justify-center overflow-y-auto bg-modalBG p-16 transition-opacity duration-300 motion-reduce:transition-none ${
				align === "center" ? "items-center" : "items-start"
			} ${visible ? "opacity-100" : "opacity-0"}`}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={label}
				className={`relative transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
					visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-[16px] scale-95 opacity-0"
				} ${className}`}>
				{children}
			</div>
		</div>,
		document.body
	);
}
