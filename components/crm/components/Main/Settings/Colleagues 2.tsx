"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdClose, MdEdit, MdSearch, MdTune } from "react-icons/md";
import { Employee, useEmployeeStore } from "@/app/store/useEmployeeStore";
import Checkbox from "../shared/Checkbox";
import ConfirmDialog from "../shared/ConfirmDialog";
import EmployeeModal from "../Company/EmployeeModal";
import SettingsTabs from "./SettingsTabs";
import Avatar from "../shared/Avatar";

const initials = (e: Employee) => `${e.firstname[0] ?? ""}${e.lastname[0] ?? ""}`.toUpperCase();

const TH = "border-l border-[#F0F0F0] px-10 py-16 text-center text-16 font-medium text-[#999999] md:text-18";
const TD = "truncate px-10 text-center text-16 text-iconColor md:text-18";

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
		<div className="p-16 md:p-30">
			<div className="flex flex-col gap-30 lg:flex-row">
				<SettingsTabs className="shrink-0 md:self-start" />

				<section className="min-w-0 flex-1">
					<div className="mb-30 flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
						<div className="flex h-[50px] w-full items-center justify-between rounded-8 border-2 border-[#E6E6E6] bg-white px-16 shadow-custom transition-colors focus-within:border-[#5EA8F5] md:w-[250px] lg:w-[350px]">
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={t("search")}
								aria-label={t("search")}
								className="w-full text-18 outline-none placeholder:text-[#CCCCCC]"
							/>
							<div className="flex shrink-0 items-center gap-10 text-[#CCCCCC]">
								<MdSearch size={20} />
								<MdTune size={20} />
							</div>
						</div>
						<div className="flex items-center gap-24">
							{selected.length > 0 && (
								<button
									type="button"
									onClick={() => setToDelete(items.filter((e) => selected.includes(e._id)))}
									className="animate-fade-in text-16 font-semibold text-danger transition-opacity hover:opacity-80">
									{t("deleteSelected")} ({selected.length})
								</button>
							)}
							<button
								type="button"
								onClick={() => { setEditing(null); setModalOpen(true); }}
								className="h-[50px] w-full rounded-4 bg-primaryColor px-30 text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 md:w-auto">
								{t("addEmployee")}
							</button>
						</div>
					</div>

					<div className="min-h-[280px] overflow-x-auto rounded-16 bg-white shadow-heroImage">
						<table className="w-full min-w-[900px] table-fixed border-collapse">
							<thead>
								<tr className="bg-[#FAFCFF]">
									<th className="w-[46px] py-16 pl-16 text-left">
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
									<tr key={e._id} className={`h-[84px] animate-fade-in transition-colors duration-150 hover:bg-[#F7F9FF] ${selected.includes(e._id) ? "bg-[#F5F9FF]" : ""}`}>
										<td className="pl-16">
											<Checkbox checked={selected.includes(e._id)} onChange={() => toggle(e._id)} label={t("selectRow")} />
										</td>
										<td className="px-10">
											<div className="flex items-center gap-10">
												<Avatar src={e.avatarUrl} initials={initials(e)} size={40} className="flex text-14" />
												<div className="min-w-0">
													<p className="truncate text-18 font-medium text-[#999999]">{e.firstname} {e.lastname}</p>
													<p className="truncate text-14 text-iconColor">{e.position}</p>
												</div>
												<span className="flex shrink-0 items-center gap-8">
													<span title={t("active")} className="h-8 w-8 rounded-50 bg-[#009A2B]" />
													<button type="button" onClick={() => setToDelete([e])} aria-label={t("remove")} className="text-[#666666] transition-colors hover:text-danger">
														<MdClose size={18} />
													</button>
													<button type="button" onClick={() => { setEditing(e); setModalOpen(true); }} aria-label={t("edit")} className="text-[#666666] transition-colors hover:text-primaryColor">
														<MdEdit size={18} />
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
						{!isLoading && items.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{t("empty")}</p>}
						{isLoading && items.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{t("loading")}</p>}
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
