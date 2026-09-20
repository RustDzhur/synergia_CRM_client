"use client";
import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RiArrowDownSLine } from "react-icons/ri";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";

interface Option<T extends string> {
	value: T;
	label: string;
}

interface Props<T extends string> {
	value: T;
	options: Option<T>[];
	onChange: (value: T) => void;
}

// «Show: Monthly ⌄» из макета: синяя подпись, значение и выпадающий список периодов.
export default function PeriodSelect<T extends string>({ value, options, onChange }: Props<T>) {
	const t = useTranslations("dashboard");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, () => setOpen(false));
	const current = options.find((o) => o.value === value);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className="flex items-center gap-6 text-16 md:text-18">
				<span className="font-medium text-primaryColor">{t("show")}:</span>
				<span className="text-[#4D4D4D]">{current?.label}</span>
				<RiArrowDownSLine size={22} className={`text-[#4D4D4D] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
			</button>
			<Dropdown open={open} className="right-0 top-full mt-8 min-w-[160px]">
				<ul className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white shadow-custom">
					{options.map((o) => (
						<li key={o.value}>
							<button
								type="button"
								onClick={() => {
									onChange(o.value);
									setOpen(false);
								}}
								className={`block w-full px-16 py-10 text-left text-16 transition-colors duration-150 hover:bg-gray ${
									o.value === value ? "font-medium text-primaryColor" : "text-[#666666]"
								}`}>
								{o.label}
							</button>
						</li>
					))}
				</ul>
			</Dropdown>
		</div>
	);
}
