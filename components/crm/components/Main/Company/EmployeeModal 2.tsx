"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose } from "react-icons/md";
import { Employee, EmployeeInput, useEmployeeStore } from "@/app/store/useEmployeeStore";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";

interface Props {
	open: boolean;
	employee: Employee | null; // null — приглашение нового сотрудника, иначе редактирование
	onClose: () => void;
}

const EMPTY: EmployeeInput = { firstname: "", lastname: "", email: "", workPhone: "", internalPhone: "", position: "", department: "" };

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
			<form onSubmit={submit} className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
				<button type="button" onClick={onClose} aria-label={t("cancel")} className="absolute right-16 top-16 text-iconColor transition-colors hover:text-black">
					<MdClose size={24} />
				</button>
				<h2 className="mb-20 text-24 font-medium text-black">{employee ? t("editTitle") : t("inviteTitle")}</h2>
				<div className="grid grid-cols-1 gap-16 md:grid-cols-2">
					<FormField label={t("firstname")} value={form.firstname ?? ""} onChange={set("firstname")} maxLength={100} />
					<FormField label={t("lastname")} value={form.lastname ?? ""} onChange={set("lastname")} maxLength={100} />
					<FormField label={t("email")} type="email" value={form.email ?? ""} onChange={set("email")} wrapperClassName="md:col-span-2" maxLength={200} />
					<FormField label={t("workPhone")} type="tel" value={form.workPhone ?? ""} onChange={set("workPhone")} maxLength={100} />
					<FormField label={t("internalPhone")} type="tel" value={form.internalPhone ?? ""} onChange={set("internalPhone")} maxLength={100} />
					<FormField label={t("position")} value={form.position ?? ""} onChange={set("position")} maxLength={100} />
					<FormField label={t("department")} value={form.department ?? ""} onChange={set("department")} maxLength={100} />
				</div>
				<div className="mt-24 flex justify-end gap-12">
					<button type="button" onClick={onClose} className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray">
						{t("cancel")}
					</button>
					<button type="submit" disabled={busy} className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">
						{employee ? t("save") : t("send")}
					</button>
				</div>
			</form>
		</Modal>
	);
}
