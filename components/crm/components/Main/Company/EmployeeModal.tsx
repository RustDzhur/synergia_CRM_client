"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbX } from "react-icons/tb";
import { Employee, EmployeeInput, useEmployeeStore } from "@/store/useEmployeeStore";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";

interface Props {
	open: boolean;
	employee: Employee | null; // null — приглашение нового сотрудника, иначе редактирование
	onClose: () => void;
}

const EMPTY: EmployeeInput = { firstname: "", lastname: "", email: "", workPhone: "", internalPhone: "", position: "", department: "", contractType: "", contractStart: "" };

// Окно «Invite Employees» / редактирования сотрудника.
export default function EmployeeModal({ open, employee, onClose }: Props) {
	const t = useTranslations("company");
	const { addEmployee, updateEmployee } = useEmployeeStore();
	const [form, setForm] = useState<EmployeeInput>(EMPTY);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) return;
		setForm(
			employee
				? {
					firstname: employee.firstname, lastname: employee.lastname, email: employee.email,
					workPhone: employee.workPhone ?? "", internalPhone: employee.internalPhone ?? "",
					position: employee.position ?? "", department: employee.department ?? "",
					contractType: employee.contractType ?? "", contractStart: employee.contractStart ?? "",
				}
				: EMPTY
		);
	}, [open, employee]);

	const set = (key: keyof EmployeeInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setForm((f) => ({ ...f, [key]: e.target.value }));

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.firstname?.trim() || !form.lastname?.trim() || !form.email?.trim()) return toast.error(t("required"));
		setBusy(true);
		const ok = employee ? await updateEmployee(employee._id, form) : await addEmployee(form);
		setBusy(false);
		if (!ok) return toast.error(t("error"));
		toast.success(employee ? t("saved") : t("invited"));
		onClose();
	}

	return (
		<Modal open={open} onClose={onClose} label={employee ? t("editTitle") : t("inviteTitle")} className="w-full max-w-[560px]">
			<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-24">
				<button type="button" onClick={onClose} aria-label={t("cancel")} className="absolute right-16 top-16 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
					<TbX size={20} />
				</button>
				<h2 className="mb-20 text-16 font-semibold text-[#f1f4ee]">{employee ? t("editTitle") : t("inviteTitle")}</h2>
				<div className="grid grid-cols-1 gap-16 md:grid-cols-2">
					<FormField label={t("firstname")} value={form.firstname ?? ""} onChange={set("firstname")} maxLength={100} />
					<FormField label={t("lastname")} value={form.lastname ?? ""} onChange={set("lastname")} maxLength={100} />
					<FormField label={t("email")} type="email" value={form.email ?? ""} onChange={set("email")} wrapperClassName="md:col-span-2" maxLength={200} />
					<FormField label={t("workPhone")} type="tel" value={form.workPhone ?? ""} onChange={set("workPhone")} maxLength={100} />
					<FormField label={t("internalPhone")} type="tel" value={form.internalPhone ?? ""} onChange={set("internalPhone")} maxLength={100} />
					<FormField label={t("position")} value={form.position ?? ""} onChange={set("position")} maxLength={100} />
					<FormField label={t("department")} value={form.department ?? ""} onChange={set("department")} maxLength={100} />
					<FormField label={t("contractType")} value={form.contractType ?? ""} onChange={set("contractType")} maxLength={100} placeholder={t("contractTypePlaceholder")} />
					<FormField label={t("contractStart")} type="date" value={form.contractStart ?? ""} onChange={set("contractStart")} />
				</div>
				<div className="mt-24 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">
						{t("cancel")}
					</button>
					<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">
						{employee ? t("save") : t("send")}
					</button>
				</div>
			</form>
		</Modal>
	);
}
