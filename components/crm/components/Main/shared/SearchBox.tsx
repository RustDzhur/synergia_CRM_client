"use client";
import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbAdjustments, TbSearch, TbX } from "react-icons/tb";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";

export interface FilterOption { value: string; label: string }
export interface FilterDef {
	key: string;
	label: string;
	options: FilterOption[]; // первым должен идти вариант «все» со значением ""
}

interface Props {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	// Фильтры списка. Если их не передали, кнопка фильтра не показывается вовсе:
	// раньше здесь всегда рисовался значок, который ничего не делал.
	filters?: FilterDef[];
	active?: Record<string, string>; // выбранные значения по ключам фильтров
	onFilter?: (key: string, value: string) => void;
	className?: string;
}

// Поле поиска раздела: лупа слева, тёмная заливка и тонкая рамка (в фокусе — салатовая).
// Высота 46px — как в образце, где поиск стоит отдельной строкой над списком.
export default function SearchBox({ value, onChange, placeholder, filters, active = {}, onFilter, className = "" }: Props) {
	const t = useTranslations("crm");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, () => setOpen(false));

	const chosen = filters?.filter((f) => active[f.key]).length ?? 0;

	return (
		<div ref={ref} className={`relative flex items-center gap-8 ${className}`}>
			<div className="fs-field flex h-46 min-w-0 flex-1 items-center gap-10 rounded-10 px-14 transition-colors">
				<TbSearch size={17} className="shrink-0 text-[#9AA396]" />
				<input
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					aria-label={placeholder}
					className="w-full min-w-0 bg-transparent text-14 text-[#f1f4ee] outline-none placeholder:text-[#9AA396]"
				/>
				{value && (
					<button type="button" onClick={() => onChange("")} aria-label={t("clearSearch")} className="shrink-0 text-[#9AA396] transition-colors hover:text-[#f1f4ee]">
						<TbX size={15} />
					</button>
				)}
			</div>

			{filters && filters.length > 0 && (
				<>
					<button
						type="button"
						aria-expanded={open}
						aria-label={t("filters")}
						onClick={() => setOpen((v) => !v)}
						className={`flex h-46 shrink-0 items-center gap-6 rounded-10 border px-12 text-13 transition-colors ${
							chosen ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#c6ff4d]" : "border-inkLine text-[#9AA396] hover:text-[#f1f4ee]"
						}`}>
						<TbAdjustments size={17} />
						{chosen > 0 && <span className="font-semibold">{chosen}</span>}
					</button>
					<Dropdown open={open} className="right-0 top-full z-50 mt-6 w-260">
						<div className="fs-popover p-12 text-left">
							{filters.map((f) => (
								<label key={f.key} className="mb-10 block last:mb-0">
									<span className="mb-6 block text-11 text-[#8c948b]">{f.label}</span>
									<select
										value={active[f.key] ?? ""}
										onChange={(e) => onFilter?.(f.key, e.target.value)}
										className="fs-field h-36 w-full px-10 text-13 outline-none">
										{f.options.map((o) => (
											<option key={o.value} value={o.value}>{o.label}</option>
										))}
									</select>
								</label>
							))}
							{chosen > 0 && (
								<button
									type="button"
									onClick={() => { for (const f of filters) onFilter?.(f.key, ""); }}
									className="mt-4 text-12 text-[#c6ff4d] transition-opacity hover:opacity-80">
									{t("filtersReset")}
								</button>
							)}
						</div>
					</Dropdown>
				</>
			)}
		</div>
	);
}
