"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbAdjustments, TbPencil, TbSearch, TbX } from "react-icons/tb";
import { Employee, useEmployeeStore } from "@/app/store/useEmployeeStore";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import Checkbox from "../shared/Checkbox";
import ConfirmDialog from "../shared/ConfirmDialog";
import EmployeeModal from "../Company/EmployeeModal";
import SettingsTabs from "./SettingsTabs";
import Avatar from "../shared/Avatar";

const initials = (e: Employee) => `${e.firstname[0] ?? ""}${e.lastname[0] ?? ""}`.toUpperCase();

const TH = "px-10 text-center";
const TD = "truncate px-10 text-center text-13";

// Settings → Colleagues (/crm/settings/colleagues): те же сотрудники, что и в разделе Company,
// но в компактной таблице из макета: имя с должностью, значок «активен», крестик (удалить) и карандаш (изменить).
export default function Colleagues() {
	const t = useTranslations("settings");
	const { items, isLoading, query, setQuery, fetchEmployees, deleteEmployee } = useEmployeeStore();
	const [selected, setSelected] = useState<string[]>([]);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Employee | null>(null);
	// одиночное удаление (крестик в строке) или групповое (выбраны чекбоксами)
	const [toDelete, setToDelete] = useState<Employee[] | null>(null);
	const firstLoad = useRef(true);

	useEffect(() => { fetchEmployees(1); }, [fetchEmployees]);

	// поиск с задержкой 300 мс, как в разделе Company
	useEffect(() => {
		if (firstLoad.current) { firstLoad.current = false; return; }
		const timer = setTimeout(() => fetchEmployees(1), 300);
		return () => clearTimeout(timer);
	}, [query, fetchEmployees]);

	// выбранные строки, которых уже нет на странице (поиск, удаление), выпадают из выбора
	useEffect(() => {
		setSelected((prev) => prev.filter((id) => items.some((e) => e._id === id)));
	}, [items]);

	const allChecked = items.length > 0 && items.every((e) => selected.includes(e._id));
	const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

	async function confirmDelete() {
		const list = toDelete ?? [];
		setToDelete(null);
		for (const e of list) await deleteEmployee(e._id);
		setSelected([]);
	}

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader />
			<div className="flex flex-col gap-20 lg:flex-row">
				<SettingsTabs className="shrink-0 md:self-start" />

				<section className="min-w-0 flex-1">
					<div className="mb-20 flex flex-col gap-12 md:flex-row md:items-center md:justify-between">
						<div className="fs-field flex h-40 w-full items-center justify-between px-12 transition-colors md:w-[260px] lg:w-[320px]">
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={t("search")}
								aria-label={t("search")}
								className="w-full bg-transparent text-13 outline-none"
							/>
							<div className="flex shrink-0 items-center gap-10 text-[#9AA396]">
								<TbSearch size={17} />
								<TbAdjustments size={17} />
							</div>
						</div>
						<div className="flex items-center gap-16">
							{selected.length > 0 && (
								<button
									type="button"
									onClick={() => setToDelete(items.filter((e) => selected.includes(e._id)))}
									className="animate-fade-in text-13 font-semibold text-danger transition-opacity hover:opacity-80">
									{t("deleteSelected")} ({selected.length})
								</button>
							)}
							<button
								type="button"
								onClick={() => { setEditing(null); setModalOpen(true); }}
								className="fs-btn fs-btn-primary h-40 w-full md:w-auto">
								{t("addEmployee")}
							</button>
						</div>
					</div>

					<div className="fs-card min-h-[280px] overflow-x-auto">
						<table className="fs-table min-w-[900px] table-fixed">
							<thead>
								<tr>
									<th className="w-[46px] pl-16 text-left">
										<Checkbox
											checked={allChecked}
											onChange={(v) => setSelected(v ? items.map((e) => e._id) : [])}
											label={t("selectAll")}
										/>
									</th>
									<th className={`${TH} w-[290px]`}>{t("name")}</th>
									<th className={TH}>{t("position")}</th>
									<th className={TH}>{t("colDepartment")}</th>
									<th className={TH}>{t("colPhone")}</th>
									<th className={`${TH} w-[200px]`}>{t("colEmail")}</th>
								</tr>
							</thead>
							<tbody>
								{items.map((e) => (
									<tr key={e._id} className={`h-[64px] animate-fade-in transition-colors duration-150 ${selected.includes(e._id) ? "bg-[rgba(198,255,77,0.06)]" : ""}`}>
										<td className="pl-16">
											<Checkbox checked={selected.includes(e._id)} onChange={() => toggle(e._id)} label={t("selectRow")} />
										</td>
										<td className="px-10">
											<div className="flex items-center gap-10">
												<Avatar
													src={e.avatarUrl}
													initials={initials(e)}
													size={32}
													className="flex text-12"
													style={e.avatarUrl ? undefined : { background: "rgba(198,255,77,0.14)", color: "#c6ff4d" }}
												/>
												<div className="min-w-0">
													<p className="truncate text-13 font-medium text-[#f1f4ee]">{e.firstname} {e.lastname}</p>
													<p className="truncate text-12 text-[#8c948b]">{e.position}</p>
												</div>
												<span className="flex shrink-0 items-center gap-8">
													<span title={t("active")} className="h-8 w-8 rounded-50 bg-[#2DDEB6]" />
													<button type="button" onClick={() => setToDelete([e])} aria-label={t("remove")} className="text-[#9AA396] transition-colors hover:text-danger">
														<TbX size={16} />
													</button>
													<button type="button" onClick={() => { setEditing(e); setModalOpen(true); }} aria-label={t("edit")} className="text-[#9AA396] transition-colors hover:text-[#c6ff4d]">
														<TbPencil size={16} />
													</button>
												</span>
											</div>
										</td>
										<td className={TD}>{e.position}</td>
										<td className={TD}>{e.department}</td>
										<td className={TD}>{e.workPhone}</td>
										<td className={TD}>{e.email}</td>
									</tr>
								))}
							</tbody>
						</table>
						{!isLoading && items.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">{t("empty")}</p>}
						{isLoading && items.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">{t("loading")}</p>}
					</div>
				</section>
			</div>

			<EmployeeModal open={modalOpen} employee={editing} onClose={() => setModalOpen(false)} />
			<ConfirmDialog
				open={toDelete !== null}
				title={t("remove")}
				text={toDelete && toDelete.length > 1 ? t("confirmDeleteMany", { count: toDelete.length }) : t("confirmDelete")}
				onCancel={() => setToDelete(null)}
				onConfirm={confirmDelete}
			/>
		</div>
	);
}
