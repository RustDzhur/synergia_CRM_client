"use client";
import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbChevronDown } from "react-icons/tb";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";

interface Option<T extends string> {
	value: T;
	label: string;
}

interface Props<T extends string> {
	value: T;
	options: Option<T>[];
	onChange: (value: T) => void;
}

// «Zeigen: Monatlich ⌄» — подпись акцентом, значение и выпадающий список периодов.
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
				className="flex items-center gap-6 whitespace-nowrap text-12">
				<span className="font-medium text-[#c6ff4d]">{t("show")}:</span>
				<span className="text-[#cfd4cb]">{current?.label}</span>
				<TbChevronDown size={15} className={`text-[#8c948b] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
			</button>
			<Dropdown open={open} className="right-0 top-full mt-8 min-w-[160px]">
				<ul className="fs-popover overflow-hidden py-4">
					{options.map((o) => (
						<li key={o.value}>
							<button
								type="button"
								onClick={() => {
									onChange(o.value);
									setOpen(false);
								}}
								className={`fs-popover-row block w-full px-14 py-10 text-left text-13 transition-colors duration-150 ${
									o.value === value ? "font-medium text-[#c6ff4d]" : "text-[#cfd4cb]"
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
