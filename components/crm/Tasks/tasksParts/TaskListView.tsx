"use client";
import { useLocale, useTranslations } from "next-intl";
import { TbBell, TbBellOff, TbCheck, TbChevronDown, TbDots, TbPin, TbSettings } from "react-icons/tb";
import { Task, TaskStatus } from "@/store/useTaskStore";
import { localeTag } from "@/utils/dateHelpers";
import Checkbox from "../../shared/Checkbox";
import DeadlineBadge from "./DeadlineBadge";
import Menu from "./Menu";
import { Action, dateText } from "./model";

interface Props {
	rows: Task[];
	isLoading: boolean;
	selected: string[];
	onSelect: (ids: string[]) => void;
	statusFilter: "all" | TaskStatus;
	statusLabel: Record<"all" | TaskStatus, string>;
	onStatusFilter: (s: "all" | TaskStatus) => void;
	action: Action;
	onAction: (a: Action) => void;
	onApply: () => void;
	onOpen: (task: Task) => void;
	onDelete: (ids: string[]) => void;
	onUpdate: (id: string, patch: { pinned?: boolean; muted?: boolean; completed?: boolean }) => void;
}

const th = "px-10 text-center";
const td = "truncate px-10 text-center text-13";

// Таблица задач (List): выбор строк, фильтр по статусу в шапке, пакетные действия под таблицей
export default function TaskListView({ rows, isLoading, selected, onSelect, statusFilter, statusLabel, onStatusFilter, action, onAction, onApply, onOpen, onDelete, onUpdate }: Props) {
	const t = useTranslations("tasks");
	const tag = localeTag(useLocale());
	const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r._id));
	const toggle = (id: string) => onSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

	return (
		<>
			<div className="fs-card min-h-[300px] overflow-x-auto">
				<table className="fs-table min-w-[900px] table-fixed">
					<thead>
						<tr>
							<th className="w-[46px] pl-16">
								<Checkbox checked={allChecked} onChange={(c) => onSelect(c ? rows.map((r) => r._id) : [])} label={t("selectAll")} />
							</th>
							<th className="w-[60px]"><TbSettings size={18} className="mx-auto block text-[#8c948b]" aria-hidden /></th>
							<th className={th}>{t("name")}</th>
							<th className={`${th} w-[200px]`}>
								<Menu
									align="right"
									options={(["all", "active", "completed", "ended"] as const).map((s) => ({ label: statusLabel[s], onClick: () => onStatusFilter(s) }))}>
									{({ open, toggle }) => (
										<button type="button" onClick={toggle} aria-expanded={open} className="inline-flex items-center gap-6 transition-colors hover:text-[#c6ff4d]">
											{statusFilter === "all" ? t("status") : statusLabel[statusFilter]}
											<TbChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
										</button>
									)}
								</Menu>
							</th>
							<th className={`${th} w-[190px]`}>{t("deadline")}</th>
							<th className={`${th} w-[150px]`}>{t("createdBy")}</th>
							<th className={`${th} w-[200px]`}>{t("responsible")}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((task) => (
							<tr key={task._id} className={`h-[52px] animate-fade-in transition-colors duration-150 ${selected.includes(task._id) ? "bg-[rgba(198,255,77,0.06)]" : ""}`}>
								<td className="pl-16">
									<Checkbox checked={selected.includes(task._id)} onChange={() => toggle(task._id)} label={t("selectRow")} />
								</td>
								<td className="text-center">
									<Menu options={[{ label: t("editTask"), onClick: () => onOpen(task) }, { label: t("actionDelete"), danger: true, onClick: () => onDelete([task._id]) }]}>
										{({ open, toggle }) => (
											<button type="button" onClick={toggle} aria-expanded={open} aria-label={t("options")} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]"><TbDots size={20} /></button>
										)}
									</Menu>
								</td>
								<td className="px-10 text-center">
									<span className="inline-flex max-w-full items-center gap-8">
										{/* Отметка «выполнено» прямо в строке: не нужно искать пакетное действие внизу таблицы */}
										<button type="button" role="checkbox" aria-checked={task.completed} aria-label={task.completed ? t("actionActive") : t("actionDone")} title={task.completed ? t("actionActive") : t("actionDone")} onClick={() => onUpdate(task._id, { completed: !task.completed })}
											className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-50 border transition-colors ${task.completed ? "border-[#c6ff4d] bg-[#c6ff4d] text-[#0a0c0b]" : "border-[rgba(255,255,255,0.28)] text-transparent hover:border-[#c6ff4d] hover:text-[#c6ff4d]"}`}>
											<TbCheck size={13} aria-hidden />
										</button>
										<button type="button" onClick={() => onOpen(task)} className={`truncate text-13 text-[#f1f4ee] transition-colors hover:text-[#c6ff4d] ${task.completed ? "line-through" : ""}`}>{task.title}</button>
										<button type="button" aria-label={t("pinned")} aria-pressed={task.pinned} onClick={() => onUpdate(task._id, { pinned: !task.pinned })} className={`shrink-0 transition-colors ${task.pinned ? "text-[#c6ff4d]" : "text-[#8C948B] hover:text-[#8c948b]"}`}><TbPin size={16} /></button>
										<button type="button" aria-label={task.muted ? t("unmute") : t("muted")} title={task.muted ? t("unmute") : t("muted")} aria-pressed={task.muted} onClick={() => onUpdate(task._id, { muted: !task.muted })} className={`shrink-0 transition-colors ${task.muted ? "text-[#8C948B] hover:text-[#cfd4cb]" : "text-[#c6ff4d] hover:text-[#f1f4ee]"}`}>{task.muted ? <TbBellOff size={16} /> : <TbBell size={16} />}</button>
									</span>
								</td>
								<td className={td}>{dateText(tag, task.updatedAt ?? task.createdAt, "short")}</td>
								<td className="px-10 text-center"><DeadlineBadge task={task} /></td>
								<td className={td}>{task.createdBy}</td>
								<td className={td}>{task.responsible}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">{isLoading ? "…" : t("empty")}</p>}
				<footer className="flex flex-wrap items-center justify-between gap-x-24 gap-y-8 border-t border-inkLine px-18 py-14 text-11 uppercase tracking-[0.08em] text-[#8c948b]">
					<span>{t("selected", { selected: selected.length, total: rows.length })}</span>
					<span>{t("total", { total: rows.length })}</span>
					<span>{t("pages", { pages: 1 })}</span>
				</footer>
			</div>

			<div className="mt-20 flex flex-wrap items-center gap-12">
				<button type="button" onClick={onApply} disabled={!action || selected.length === 0} className="fs-btn fs-btn-ghost h-38 disabled:cursor-not-allowed disabled:opacity-40">
					{t("apply")}
				</button>
				<Menu
					options={[
						{ label: t("actionDone"), onClick: () => onAction("done") },
						{ label: t("actionActive"), onClick: () => onAction("active") },
						{ label: t("actionDelete"), danger: true, onClick: () => onAction("delete") },
					]}>
					{({ open, toggle }) => (
						<button type="button" onClick={toggle} aria-expanded={open} className="fs-btn fs-btn-ghost h-38">
							{action === "done" ? t("actionDone") : action === "active" ? t("actionActive") : action === "delete" ? t("actionDelete") : t("selectAction")}
							<TbChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
						</button>
					)}
				</Menu>
			</div>
		</>
	);
}
