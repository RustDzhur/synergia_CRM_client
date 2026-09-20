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

// Таблица списков из макета: карточка со скруглением и тенью, чекбоксы, серые заголовки.
export default function EntityTable<T>({ rows, columns, getId, selected, onToggle, onToggleAll, isLoading, emptyText }: Props<T>) {
	const t = useTranslations("crm");
	const allChecked = rows.length > 0 && rows.every((r) => selected.includes(getId(r)));

	return (
		<div className="overflow-x-auto rounded-16 bg-white shadow-custom">
			<table className="w-full min-w-[760px] table-fixed border-collapse">
				<thead>
					<tr className="border-b border-[#EFEFEF]">
						<th className="w-[46px] py-16 pl-16 text-left">
							<Checkbox checked={allChecked} onChange={onToggleAll} label={t("selectAll")} />
						</th>
						{columns.map((c) => (
							<th
								key={c.key}
								style={{ width: c.width }}
								className={`border-l border-[#F0F0F0] px-10 py-16 text-18 font-medium text-[#999999] ${
									c.align === "left" ? "text-left" : "text-center"
								}`}>
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
								className={`h-[60px] animate-fade-in transition-colors duration-150 hover:bg-[#F7F9FF] ${
									checked ? "bg-[#F5F9FF]" : ""
								}`}>
								<td className="pl-16">
									<Checkbox checked={checked} onChange={() => onToggle(id)} label={t("selectRow")} />
								</td>
								{columns.map((c) => (
									<td
										key={c.key}
										className={`truncate px-10 text-18 text-[#999999] ${c.align === "left" ? "text-left" : "text-center"}`}>
										{c.render(row)}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
			{isLoading && rows.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{t("loading")}</p>}
			{!isLoading && rows.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{emptyText}</p>}
			<div className="h-[16px]" />
		</div>
	);
}
