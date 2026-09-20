"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "@/app/utils/usePresence";
import { useScrollLock } from "@/app/utils/useScrollLock";

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
	// на телефоне окно занимает весь экран (без полей вокруг) — так сделаны окна события и задачи в Figma
	flushOnMobile?: boolean;
}

// Окно поверх страницы: тёмная подложка, плавное появление и исчезновение, закрытие по Escape и клику
// мимо. Содержимое размонтируется после анимации закрытия, поэтому формы внутри каждый раз «чистые».
export default function Modal({ open, onClose, children, className = "", align = "center", label, zIndex = 60, flushOnMobile = false }: Props) {
	const { rendered, visible } = usePresence(open, 300);
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	useScrollLock(open);

	if (!mounted || !rendered) return null;

	return createPortal(
		<div
			onMouseDown={(e) => e.target === e.currentTarget && onClose()}
			style={{ zIndex }}
			className={`fixed inset-0 flex justify-center overflow-y-auto bg-modalBG ${flushOnMobile ? "p-0 md:p-16" : "p-16"} transition-opacity duration-300 motion-reduce:transition-none ${
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
