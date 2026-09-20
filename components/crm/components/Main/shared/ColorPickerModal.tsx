"use client";
import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { MdClose } from "react-icons/md";
import { COLOR_PALETTE } from "@/app/utils/stageColors";
import Modal from "./Modal";

interface Props {
	open: boolean;
	value: string; // выбранный сейчас цвет "#RRGGBB"
	onChange: (color: string) => void;
	onClose: () => void;
}

// Выбор цвета стадии: сетка 15×5, полоса текущего цвета и «Custom Color» (системный выбор цвета).
export default function ColorPickerModal({ open, value, onChange, onClose }: Props) {
	const t = useTranslations("crm");
	const customRef = useRef<HTMLInputElement>(null);
	const current = value.toUpperCase();

	return (
		<Modal open={open} onClose={onClose} label={t("chooseColor")} zIndex={80} className="w-full max-w-[480px]">
			<div className="rounded-24 bg-white p-20 shadow-heroImage">
				<div className="flex justify-end">
					<button type="button" onClick={onClose} aria-label={t("close")} className="text-[#4D4D4D] transition-colors hover:text-black">
						<MdClose size={28} />
					</button>
				</div>
				<div className="mx-auto mt-24 grid w-fit grid-cols-[repeat(15,20px)] gap-10">
					{COLOR_PALETTE.map((color, i) => (
						<button
							key={`${color}-${i}`}
							type="button"
							aria-label={color}
							onClick={() => onChange(color)}
							style={{ backgroundColor: color }}
							className={`h-20 w-20 rounded-4 border transition-transform duration-150 hover:scale-125 ${
								current === color ? "border-[#4D4D4D] ring-2 ring-[#CCCCCC]" : "border-[#E6E6E6]"
							}`}
						/>
					))}
				</div>
				<div className="mt-24 flex items-center justify-between">
					<div style={{ backgroundColor: value }} className="h-30 w-60 rounded-4 border border-[#E6E6E6] transition-colors duration-200" />
					<button
						type="button"
						onClick={() => customRef.current?.click()}
						className="text-16 font-medium text-[#4D4D4D] transition-colors hover:text-primaryColor">
						{t("customColor")}
					</button>
					<input
						ref={customRef}
						type="color"
						value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#34a2e8"}
						onChange={(e) => onChange(e.target.value.toUpperCase())}
						className="sr-only"
						tabIndex={-1}
					/>
				</div>
			</div>
		</Modal>
	);
}
