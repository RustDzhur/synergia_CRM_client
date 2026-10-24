"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdSettings } from "react-icons/md";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import Checkbox from "../../Checkbox";
import type { Field } from "../config";

interface Props { fields: Field[]; hiddenKeys: string[]; onToggle: (key: string) => void; label: (key: string) => string }

// Шестерёнка в шапке таблицы: какие колонки показывать (колонку name скрыть нельзя)
export default function ColumnsMenu({ fields, hiddenKeys, onToggle, label }: Props) {
	const tr = useTranslations("records");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, () => setOpen(false));

	return (
		<div ref={ref} className="relative inline-block">
			<button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={tr("columns")} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
				<MdSettings size={20} className={`transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
			</button>
			<Dropdown open={open} className="left-0 top-full mt-8 min-w-[220px]">
				<div className="fs-popover p-12 text-left">
					<p className="mb-8 text-12 text-[#8c948b]">{tr("columns")}</p>
					{fields.map((f) => (
						// строка кликабельна целиком; флажок сам обрабатывает нажатие, поэтому его обёртка гасит всплытие
						<div
							key={f.key}
							onClick={() => f.key !== "name" && onToggle(f.key)}
							className={`flex items-center gap-10 py-6 text-13 text-[#cfd4cb] ${f.key === "name" ? "opacity-60" : "cursor-pointer"}`}>
							<span onClick={(e) => e.stopPropagation()}>
								<Checkbox
									checked={f.key === "name" || !hiddenKeys.includes(f.key)}
									onChange={() => f.key !== "name" && onToggle(f.key)}
									label={label(f.key)}
								/>
							</span>
							{label(f.key)}
						</div>
					))}
				</div>
			</Dropdown>
		</div>
	);
}
