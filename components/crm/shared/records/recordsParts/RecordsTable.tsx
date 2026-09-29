"use client";
import { useTranslations } from "next-intl";
import { MdArrowDownward, MdArrowUpward, MdEdit } from "react-icons/md";
import Checkbox from "../../Checkbox";
import type { Field, RecordItem } from "../config";
import ColumnsMenu from "./ColumnsMenu";

export type Sort = { key: string; dir: 1 | -1 } | null;

interface Props {
	rows: RecordItem[];
	fields: Field[];
	columns: Field[];
	hiddenKeys: string[];
	sort: Sort;
	onSort: (sort: Sort) => void;
	selected: string[];
	onSelect: (ids: string[]) => void;
	onToggleColumn: (key: string) => void;
	onOpen: (record: RecordItem) => void;
	display: (f: Field, value: string) => string;
	statusColors: Record<string, string>;
	// подпись колонки на текущем языке (f_<ключ> из словаря раздела)
	fieldLabel: (key: string) => string;
	searching: boolean;
}

const th = "px-10 text-center";

export default function RecordsTable({ rows, fields, columns, hiddenKeys, sort, onSort, selected, onSelect, onToggleColumn, onOpen, display, statusColors, fieldLabel, searching }: Props) {
	const tr = useTranslations("records");
	const tc = useTranslations("crm");
	const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));
	const toggle = (id: string) => onSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

	return (
		<div className="fs-card min-h-[360px] overflow-x-auto md:min-h-[420px] lg:min-h-[500px]">
			<table className="fs-table min-w-[820px] table-fixed">
				<thead>
					<tr>
						<th className="w-[46px] pl-16">
							<Checkbox checked={allChecked} onChange={(v) => onSelect(v ? rows.map((r) => r.id) : [])} label={tc("selectAll")} />
						</th>
						<th className="w-[52px]">
							<ColumnsMenu fields={fields} hiddenKeys={hiddenKeys} onToggle={onToggleColumn} label={fieldLabel} />
						</th>
						{columns.map((f) => {
							const active = sort?.key === f.key;
							return (
								<th key={f.key} aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"} className={th}>
									<button
										type="button"
										onClick={() => onSort(active && sort!.dir === -1 ? null : { key: f.key, dir: active ? -1 : 1 })}
										className={`inline-flex max-w-full items-center gap-6 transition-colors hover:text-[#c6ff4d] ${active ? "text-[#c6ff4d]" : ""}`}>
										<span className="truncate">{fieldLabel(f.key)}</span>
										{active && (sort!.dir === 1 ? <MdArrowUpward size={14} /> : <MdArrowDownward size={14} />)}
									</button>
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => {
						const checked = selected.includes(r.id);
						return (
							<tr
								key={r.id}
								onClick={() => onOpen(r)}
								className={`animate-fade-in cursor-pointer transition-colors duration-150 ${checked ? "bg-[rgba(198,255,77,0.06)]" : ""}`}>
								<td className="pl-16" onClick={(e) => e.stopPropagation()}>
									<Checkbox checked={checked} onChange={() => toggle(r.id)} label={tc("selectRow")} />
								</td>
								<td className="text-center">
									<button type="button" aria-label={tr("editRow")} onClick={(e) => { e.stopPropagation(); onOpen(r); }} className="text-[#9AA396] transition-colors hover:text-[#c6ff4d]">
										<MdEdit size={17} />
									</button>
								</td>
								{columns.map((f) => {
									const value = r.values[f.key] ?? "";
									return (
										<td key={f.key} className="truncate text-13">
											{f.key === "status" && value ? (
												<span className="inline-flex items-center gap-8">
													<span className="h-8 w-8 rounded-50" style={{ background: statusColors[value] ?? "#999999" }} />
													{display(f, value)}
												</span>
											) : (
												display(f, value)
											)}
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
			{rows.length === 0 && <p className="py-40 text-center text-14 text-[#8c948b]">{searching ? tr("nothingFound") : tr("empty")}</p>}
		</div>
	);
}
