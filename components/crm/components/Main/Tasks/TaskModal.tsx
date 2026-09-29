"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbX } from "react-icons/tb";
import { Task, useTaskStore } from "@/store/useTaskStore";
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
			<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-24">
				<button type="button" onClick={onClose} aria-label={t("cancel")} className="absolute right-16 top-16 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
					<TbX size={20} />
				</button>
				<h2 className="mb-20 text-16 font-semibold text-[#f1f4ee]">{task ? t("editTask") : t("newTask")}</h2>
				<div className="flex flex-col gap-16">
					<FormField label={t("title")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} autoFocus />
					<label className="block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("description")}</span>
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
				<div className="mt-24 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">
						{t("cancel")}
					</button>
					<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">
						{t("save")}
					</button>
				</div>
			</form>
		</Modal>
	);
}
