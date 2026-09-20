"use client";
import React, { useRef, useState } from "react";
import { MdSearch } from "react-icons/md";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import { fieldClass } from "./FormField";

export interface SuggestOption {
	key: string;
	title: string;
	lines?: string[]; // телефон, e-mail и т.п. под названием
}

interface Props {
	value: string;
	onChange: (text: string) => void;
	onPick: (option: SuggestOption) => void;
	options: SuggestOption[]; // уже отфильтрованные
	placeholder?: string;
	showSearchIcon?: boolean;
	className?: string;
}

// Поле с выпадающими подсказками (поиск контакта или компании): «Contact Name Phone Or E-Mail».
export default function SuggestInput({ value, onChange, onPick, options, placeholder, showSearchIcon, className = "" }: Props) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	useClickOutside(rootRef, open, () => setOpen(false));

	return (
		<div ref={rootRef} className="relative">
			<input
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				placeholder={placeholder}
				className={`${fieldClass} ${showSearchIcon ? "pr-36" : ""} ${className}`}
				autoComplete="off"
			/>
			{showSearchIcon && <MdSearch size={18} className="pointer-events-none absolute right-10 top-[11px] text-[#B3B3B3]" />}
			<Dropdown open={open && options.length > 0} className="left-0 right-0 top-full">
				<ul className="max-h-[220px] overflow-y-auto rounded-b-8 border border-[#EFEFEF] bg-[#F5F5F5] shadow-custom">
					{options.slice(0, 6).map((o) => (
						<li key={o.key}>
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()} // не терять фокус поля до выбора
								onClick={() => {
									onPick(o);
									setOpen(false);
								}}
								className="block w-full px-10 py-8 text-left transition-colors duration-150 hover:bg-[#EBEEF8]">
								<span className="block text-14 font-medium text-[#666666]">{o.title}</span>
								{o.lines?.filter(Boolean).map((line, i) => (
									<span key={i} className="block text-14 text-[#999999]">{line}</span>
								))}
							</button>
						</li>
					))}
				</ul>
			</Dropdown>
		</div>
	);
}
