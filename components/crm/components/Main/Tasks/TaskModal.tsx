"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose } from "react-icons/md";
import { Task, useTaskStore } from "@/app/store/useTaskStore";
import Modal from "../shared/Modal";
import FormField, { fieldClass } from "../shared/FormField";

interface Props {
	open: boolean;
	task: Task | null; // null — новая задача
	onClose: () => void;
}

interface Form { title: string; description: string; deadline: string; responsible: string }
const EMPTY: Form = { title: "", description: "", deadline: "", responsible: "" };

// Окно создания и редактирования задачи.
export default function TaskModal({ open, task, onClose }: Props) {
	const t = useTranslations("tasks");
	const { addTask, updateTask } = useTaskStore();
	const [form, setForm] = useState<Form>(EMPTY);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!open) return;
		setForm(
			task
				? { title: task.title, description: task.description ?? "", deadline: task.deadline ?? "", responsible: task.responsible ?? "" }
				: EMPTY
		);
	}, [open, task]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.title.trim()) return toast.error(t("titleRequired"));
		setBusy(true);
		const saved = task ? await updateTask(task._id, form) : await addTask(form);
		setBusy(false);
		if (!saved) return toast.error(t("error"));
		toast.success(t("saved"));
		onClose();
	}

	return (
		<Modal open={open} onClose={onClose} label={task ? t("editTask") : t("newTask")} className="w-full max-w-[560px]">
			<form onSubmit={submit} className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
				<button type="button" onClick={onClose} aria-label={t("cancel")} className="absolute right-16 top-16 text-iconColor transition-colors hover:text-black">
					<MdClose size={24} />
				</button>
				<h2 className="mb-20 text-24 font-medium text-black">{task ? t("editTask") : t("newTask")}</h2>
				<div className="flex flex-col gap-16">
					<FormField label={t("title")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} autoFocus />
					<label className="block">
						<span className="mb-6 block text-16 text-[#999999]">{t("description")}</span>
						<textarea
							value={form.description}
							onChange={(e) => setForm({ ...form, description: e.target.value })}
							rows={4}
							maxLength={500}
							className={`${fieldClass} !h-auto resize-none py-8`}
						/>
					</label>
					<FormField label={t("deadline")} type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
					<FormField label={t("responsible")} value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} maxLength={100} />
				</div>
				<div className="mt-24 flex justify-end gap-12">
					<button type="button" onClick={onClose} className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray">
						{t("cancel")}
					</button>
					<button type="submit" disabled={busy} className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60">
						{t("save")}
					</button>
				</div>
			</form>
		</Modal>
	);
}
