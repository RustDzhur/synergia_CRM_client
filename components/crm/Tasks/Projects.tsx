"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbArchive, TbPencil, TbPlus, TbTrash } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import { Task, useTaskStore } from "@/store/useTaskStore";
import { localeTag } from "@/utils/dateHelpers";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";

export interface Project {
	id: string;
	name: string;
	description: string;
	status: "planned" | "active" | "paused" | "done";
	startDate: string;
	endDate: string;
	responsible: string;
	color: string;
	archived: boolean;
	createdByName?: string;
}

const STATUSES: Project["status"][] = ["planned", "active", "paused", "done"];
const COLORS = ["#34A2E8", "#2DDEB6", "#F4A100", "#8A8FF5", "#EB5757", "#57CAEF"];
const EMPTY: Omit<Project, "id" | "archived"> = {
	name: "", description: "", status: "planned", startDate: "", endDate: "", responsible: "", color: COLORS[0],
};

// Вкладка «Проекты»: карточки проектов с прогрессом по их задачам.
// Прогресс считается по задачам, а не хранится отдельно — иначе он разошёлся бы с ними.
export default function Projects({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
	const t = useTranslations("tasks");
	const locale = useLocale();
	const tag = localeTag(locale);
	const tasks = useTaskStore((s) => s.tasks);
	const fetchTasks = useTaskStore((s) => s.fetchTasks);

	const [items, setItems] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [showArchived, setShowArchived] = useState(false);
	const [form, setForm] = useState<(Omit<Project, "id" | "archived"> & { id?: string }) | null>(null);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");
	const [toDelete, setToDelete] = useState<Project | null>(null);
	const [openId, setOpenId] = useState("");

	const load = useCallback(async () => {
		const res = await apiCall<Project[]>(`/api/projects?archived=${showArchived ? 1 : 0}`, "GET", undefined, { cache: "no-store" });
		setLoading(false);
		if (!res.ok) return void setNotice(res.message);
		setItems(res.data ?? []);
	}, [showArchived]);

	useEffect(() => { load(); }, [load]);
	useEffect(() => { fetchTasks(); }, [fetchTasks]);

	// прогресс проекта: сколько его задач уже выполнено
	const progress = useMemo(() => {
		const map = new Map<string, { done: number; total: number }>();
		for (const task of tasks) {
			if (!task.project) continue;
			const cur = map.get(task.project) ?? { done: 0, total: 0 };
			cur.total += 1;
			if (task.completed) cur.done += 1;
			map.set(task.project, cur);
		}
		return map;
	}, [tasks]);

	const openProject = items.find((p) => p.id === openId) ?? null;
	const openTasks = useMemo(() => (openProject ? tasks.filter((task) => task.project === openProject.id) : []), [openProject, tasks]);

	async function save(e: React.FormEvent) {
		e.preventDefault();
		if (!form) return;
		if (!form.name.trim()) return void setNotice(t("projectNameRequired"));
		if (form.startDate && form.endDate && form.endDate < form.startDate) return void setNotice(t("projectDatesInvalid"));
		setBusy(true);
		const res = form.id
			? await apiCall(`/api/projects/${form.id}`, "PATCH", form)
			: await apiCall("/api/projects", "POST", form);
		setBusy(false);
		if (!res.ok) return void setNotice(res.message);
		setForm(null);
		setNotice("");
		toast.success(t("projectSaved"));
		load();
	}

	async function toggleArchive(project: Project) {
		const res = await apiCall(`/api/projects/${project.id}`, "PATCH", { archived: !project.archived });
		if (!res.ok) return void toast.error(res.message);
		load();
	}

	async function confirmDelete() {
		if (!toDelete) return;
		const res = await apiCall(`/api/projects/${toDelete.id}`, "DELETE");
		setToDelete(null);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("projectDeleted"));
		if (openId === toDelete.id) setOpenId("");
		// задачи проектов не удаляются — только теряют привязку, поэтому список перечитываем
		fetchTasks();
		load();
	}

	const field = "fs-field h-40 w-full px-12 text-13 outline-none";
	const label = "mb-6 block text-12 text-[#8c948b]";
	const chipTone: Record<Project["status"], string> = {
		planned: "text-[#9AA396]", active: "text-[#c6ff4d]", paused: "text-[#F4A100]", done: "text-[#2DDEB6]",
	};

	return (
		<div className="flex flex-col gap-16">
			<div className="flex flex-wrap items-center justify-between gap-12">
				<button
					type="button"
					aria-pressed={showArchived}
					onClick={() => setShowArchived((v) => !v)}
					className={`fs-btn fs-btn-ghost h-34 ${showArchived ? "border-inkAccentLine text-[#c6ff4d]" : ""}`}>
					<TbArchive size={15} /> {t("projectArchived")}
				</button>
				<button type="button" onClick={() => { setNotice(""); setForm({ ...EMPTY }); }} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("projectNew")}
				</button>
			</div>

			{notice && <p className="text-12 text-[#9AA396]">{notice}</p>}

			{loading ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">…</p>
			) : items.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{showArchived ? t("projectNoArchived") : t("projectEmpty")}</p>
			) : (
				<div className="grid gap-16 md:grid-cols-2 lg:grid-cols-3">
					{items.map((project) => {
						const p = progress.get(project.id) ?? { done: 0, total: 0 };
						const percent = p.total ? Math.round((p.done / p.total) * 100) : 0;
						return (
							<section key={project.id} className="fs-card flex flex-col p-16">
								<header className="flex items-start gap-10">
									<span className="mt-2 h-10 w-10 shrink-0 rounded-50" style={{ background: project.color }} aria-hidden />
									<button type="button" onClick={() => setOpenId(project.id)} className="min-w-0 flex-1 text-left">
										<span className="block truncate text-15 font-semibold text-[#f1f4ee]">{project.name}</span>
										<span className={`mt-2 block text-11 ${chipTone[project.status]}`}>{t(`projectStatus_${project.status}`)}</span>
									</button>
									<button type="button" aria-label={t("projectEdit")} onClick={() => { setNotice(""); setForm({ ...project }); }} className="shrink-0 text-[#9AA396] transition-colors hover:text-[#f1f4ee]">
										<TbPencil size={16} />
									</button>
								</header>

								{project.description && <p className="mt-10 line-clamp-2 text-12 text-[#8c948b]">{project.description}</p>}

								<dl className="mt-12 flex flex-col gap-4 text-12">
									{project.responsible && (
										<div className="flex justify-between gap-10"><dt className="text-[#9AA396]">{t("filterResponsible")}</dt><dd className="truncate text-[#cfd4cb]">{project.responsible}</dd></div>
									)}
									{(project.startDate || project.endDate) && (
										<div className="flex justify-between gap-10">
											<dt className="text-[#9AA396]">{t("projectPeriod")}</dt>
											<dd className="text-[#cfd4cb]">
												{project.startDate ? new Date(project.startDate).toLocaleDateString(tag, { day: "numeric", month: "short" }) : "—"}
												{" — "}
												{project.endDate ? new Date(project.endDate).toLocaleDateString(tag, { day: "numeric", month: "short" }) : "—"}
											</dd>
										</div>
									)}
								</dl>

								<div className="mt-14">
									<div className="mb-6 flex items-center justify-between text-11 text-[#9AA396]">
										<span>{t("projectProgress")}</span>
										<span>{p.total ? `${p.done}/${p.total} · ${percent}%` : t("projectNoTasks")}</span>
									</div>
									<div className="h-6 overflow-hidden rounded-50 bg-[rgba(255,255,255,0.06)]">
										<div className="h-full rounded-50" style={{ width: `${percent}%`, background: project.color }} />
									</div>
								</div>

								<div className="mt-14 flex items-center gap-12 border-t border-inkLine pt-12 text-12">
									<button type="button" onClick={() => toggleArchive(project)} className="text-[#9AA396] transition-colors hover:text-[#f1f4ee]">
										{project.archived ? t("projectUnarchive") : t("projectArchive")}
									</button>
									<button type="button" onClick={() => setToDelete(project)} className="ml-auto flex items-center gap-6 text-[#9AA396] transition-colors hover:text-danger">
										<TbTrash size={14} /> {t("delete")}
									</button>
								</div>
							</section>
						);
					})}
				</div>
			)}

			{/* Карточка проекта: его задачи. Добавить задачу можно прямо здесь — она сразу привяжется к проекту */}
			{openProject && (
				<section className="fs-card p-16">
					<header className="mb-12 flex items-center justify-between gap-12">
						<h3 className="text-14 font-semibold text-[#f1f4ee]">{openProject.name}</h3>
						<button type="button" onClick={() => setOpenId("")} className="text-12 text-[#9AA396] transition-colors hover:text-[#f1f4ee]">{t("projectClose")}</button>
					</header>
					{openTasks.length === 0 ? (
						<p className="text-13 text-[#8c948b]">{t("projectNoTasks")}</p>
					) : (
						<ul className="flex flex-col gap-4">
							{openTasks.map((task) => (
								<li key={task._id}>
									<button type="button" onClick={() => onOpenTask(task)} className="flex w-full items-center gap-10 rounded-8 px-8 py-6 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]">
										<span className={`h-8 w-8 shrink-0 rounded-50 ${task.completed ? "bg-[#2DDEB6]" : "bg-[#F4A100]"}`} aria-hidden />
										<span className={`min-w-0 flex-1 truncate text-13 ${task.completed ? "text-[#9AA396] line-through" : "text-[#f1f4ee]"}`}>{task.title}</span>
										{task.deadline && (
											<span className="shrink-0 text-11 text-[#9AA396]">
												{new Date(task.deadline).toLocaleDateString(tag, { day: "numeric", month: "short" })}
											</span>
										)}
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			<Modal open={form !== null} onClose={() => setForm(null)} label={t("projectNew")} className="w-full max-w-[520px]">
				{form && (
					<form onSubmit={save} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20">
						<h2 className="mb-16 text-16 font-semibold text-[#f1f4ee]">{form.id ? t("projectEdit") : t("projectNew")}</h2>
						<div className="flex flex-col gap-12">
							<label>
								<span className={label}>{t("projectName")}</span>
								<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} className={field} required />
							</label>
							<label>
								<span className={label}>{t("projectDescription")}</span>
								<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={3} className="fs-field w-full resize-none px-12 py-10 text-13 outline-none" />
							</label>
							<div className="grid grid-cols-2 gap-12">
								<label>
									<span className={label}>{t("projectStatus")}</span>
									<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project["status"] })} className={field}>
										{STATUSES.map((s) => <option key={s} value={s}>{t(`projectStatus_${s}`)}</option>)}
									</select>
								</label>
								<label>
									<span className={label}>{t("filterResponsible")}</span>
									<input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} maxLength={120} className={field} />
								</label>
								<label>
									<span className={label}>{t("projectStart")}</span>
									<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={field} />
								</label>
								<label>
									<span className={label}>{t("projectEnd")}</span>
									<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={field} />
								</label>
							</div>
							<div>
								<span className={label}>{t("projectColor")}</span>
								<div className="flex flex-wrap items-center gap-8">
									{COLORS.map((с) => (
										<button
											key={с}
											type="button"
											aria-label={с}
											aria-pressed={form.color === с}
											onClick={() => setForm({ ...form, color: с })}
											className={`h-26 w-26 rounded-50 border-2 transition-transform ${form.color === с ? "border-[#f1f4ee] scale-110" : "border-transparent"}`}
											style={{ background: с }}
										/>
									))}
								</div>
							</div>
						</div>
						{notice && <p className="mt-12 text-12 text-[#F4A100]">{notice}</p>}
						<div className="mt-18 flex items-center justify-end gap-10">
							<button type="button" onClick={() => setForm(null)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
							<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-[0.5]">{t("save")}</button>
						</div>
					</form>
				)}
			</Modal>

			<ConfirmDialog
				open={toDelete !== null}
				title={t("projectDelete")}
				text={t("projectDeleteConfirm", { name: toDelete?.name ?? "" })}
				onCancel={() => setToDelete(null)}
				onConfirm={confirmDelete}
				confirmLabel={t("delete")}
			/>
		</div>
	);
}
