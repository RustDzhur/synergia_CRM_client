"use client";
import React from "react";
import { useTranslations } from "next-intl";
import Checkbox from "./Checkbox";

export interface Column<T> {
	key: string;
	header: string;
	render: (row: T) => React.ReactNode;
	align?: "left" | "center";
	// ширина колонки в процентах (доля таблицы)
	width?: string;
}

interface Props<T> {
	rows: T[];
	columns: Column<T>[];
	getId: (row: T) => string;
	selected: string[];
	onToggle: (id: string) => void;
	onToggleAll: (checked: boolean) => void;
	isLoading: boolean;
	emptyText: string;
}

// Таблица списков: карточка с рамкой, чекбоксы, приглушённые заголовки в верхнем регистре.
export default function EntityTable<T>({ rows, columns, getId, selected, onToggle, onToggleAll, isLoading, emptyText }: Props<T>) {
	const t = useTranslations("crm");
	const allChecked = rows.length > 0 && rows.every((r) => selected.includes(getId(r)));

	return (
		<div className="fs-card overflow-x-auto">
			<table className="fs-table min-w-[760px] table-fixed">
				<thead>
					<tr>
						<th className="w-[46px] pl-16 text-left">
							<Checkbox checked={allChecked} onChange={onToggleAll} label={t("selectAll")} />
						</th>
						{columns.map((c) => (
							<th
								key={c.key}
								style={{ width: c.width }}
								className={`px-10 ${c.align === "left" ? "text-left" : "text-center"}`}>
								{c.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const id = getId(row);
						const checked = selected.includes(id);
						return (
							<tr
								key={id}
								className={`animate-fade-in transition-colors duration-150 ${checked ? "bg-[rgba(198,255,77,0.06)]" : ""}`}>
								<td className="pl-16">
									<Checkbox checked={checked} onChange={() => onToggle(id)} label={t("selectRow")} />
								</td>
								{columns.map((c) => (
									<td
										key={c.key}
										className={`truncate text-13 ${c.align === "left" ? "text-left" : "text-center"}`}>
										{c.render(row)}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
			{isLoading && rows.length === 0 && <p className="py-40 text-center text-14 text-[#8c948b]">{t("loading")}</p>}
			{!isLoading && rows.length === 0 && <p className="py-40 text-center text-14 text-[#8c948b]">{emptyText}</p>}
		</div>
	);
}
