"use client";
import React, { useRef, useState } from "react";
import { TbSearch } from "react-icons/tb";
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
			{showSearchIcon && <TbSearch size={16} className="pointer-events-none absolute right-11 top-[12px] text-[#9AA396]" />}
			<Dropdown open={open && options.length > 0} className="left-0 right-0 top-full mt-6">
				<ul className="fs-popover fs-scroll max-h-[240px] overflow-y-auto">
					{options.slice(0, 6).map((o) => (
						<li key={o.key}>
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()} // не терять фокус поля до выбора
								onClick={() => {
									onPick(o);
									setOpen(false);
								}}
								className="fs-popover-row block w-full px-12 py-8 text-left transition-colors duration-150">
								<span className="block text-13 font-medium text-[#f1f4ee]">{o.title}</span>
								{o.lines?.filter(Boolean).map((line, i) => (
									<span key={i} className="block text-12 text-[#8c948b]">{line}</span>
								))}
							</button>
						</li>
					))}
				</ul>
			</Dropdown>
		</div>
	);
}
