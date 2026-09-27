"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbStar, TbStarFilled, TbX } from "react-icons/tb";
import { taskStatus, useTaskStore } from "@/app/store/useTaskStore";
import Modal from "../../shared/Modal";

interface Props {
	taskId: string | null; // null — окно закрыто
	onClose: () => void;
}

// Окно задачи из календаря (Figma: Calendar-Modal_Task): название, статус, описание, «Edit» и «Finish».
// Задача читается из хранилища по id, а не копируется при открытии: иначе звёздочка и статус
// показывали бы состояние на момент нажатия и не менялись после ответа сервера.
export default function TaskPreviewModal({ taskId, onClose }: Props) {
	const t = useTranslations("collab");
	const locale = useLocale();
	const { tasks, isLoading, updateTask, fetchTasks } = useTaskStore();
	const [shownId, setShownId] = useState<string | null>(taskId);
	const [busy, setBusy] = useState(false);
	// ref, а не только state: два нажатия подряд в одном кадре видят один и тот же state
	const busyRef = useRef(false);

	// запоминаем id и после закрытия — окно плавно гаснет с теми же данными
	useEffect(() => {
		if (taskId) setShownId(taskId);
	}, [taskId]);

	// id из пропса приоритетнее запомненного: в первом кадре после нажатия shownId ещё не обновился
	const task = tasks.find((x) => x._id === (taskId ?? shownId)) ?? null;
	const number = task ? tasks.indexOf(task) + 1 : 0;
	const open = taskId !== null && task !== null;

	// задачу удалили в другом месте — показывать в окне нечего
	useEffect(() => {
		if (taskId && !task && !isLoading) onClose();
	}, [taskId, task, isLoading, onClose]);

	const status = task ? taskStatus(task) : "active";
	const statusText = status === "completed" ? t("statusCompleted") : status === "ended" ? t("statusOverdue") : t("statusInProgress");
	const statusColor = status === "ended" ? "text-[#ff7b8a]" : status === "completed" ? "text-[#0BD065]" : "text-[#c6ff4d]";

	async function finish() {
		if (!task || busyRef.current) return; // второе нажатие, пока идёт запрос, игнорируем
		busyRef.current = true;
		setBusy(true);
		const ok = await updateTask(task._id, { completed: true });
		busyRef.current = false;
		setBusy(false);
		// при ошибке окно остаётся открытым — можно повторить (store сам откатывает состояние)
		if (ok) {
			toast.success(t("taskFinished"));
			onClose();
		} else {
			toast.error(t("error"));
			fetchTasks(); // вдруг задачу уже удалили или изменили в другом месте — сверяемся с сервером
		}
	}

	async function togglePin() {
		if (!task || busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		const ok = await updateTask(task._id, { pinned: !task.pinned });
		busyRef.current = false;
		setBusy(false);
		if (!ok) {
			toast.error(t("error"));
			fetchTasks();
		}
	}

	return (
		<Modal open={open} onClose={onClose} label={task?.title ?? t("task")} className="w-full max-w-[788px]" flushOnMobile>
			<div className="fs-popover fs-scroll overflow-hidden max-md:min-h-screen max-md:rounded-[0px] max-md:border-0">
				<div className="flex items-center justify-between gap-16 border-b border-inkLine bg-[rgba(255,255,255,0.02)] px-16 py-14 md:border-0 md:bg-transparent md:px-32 md:pt-24">
					<h2 className="min-w-0 truncate text-16 font-semibold text-[#f1f4ee]">{task?.title}</h2>
					<button type="button" onClick={onClose} aria-label={t("close")} className="shrink-0 text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
						<TbX size={20} />
					</button>
				</div>
				<p className={`px-16 py-14 text-13 md:px-32 md:pt-10 ${statusColor}`}>
					{t("taskNumber", { number })} - {statusText}
				</p>
				<div className="flex min-h-[140px] items-start justify-between gap-16 border-y border-inkLine px-16 py-16 md:px-32">
					<p className="whitespace-pre-wrap break-words text-13 text-[#cfd4cb]">{task?.description || task?.title}</p>
					<button
						type="button"
						aria-label={t("pin")}
						aria-pressed={task?.pinned ?? false}
						onClick={togglePin}
						className={`shrink-0 transition-colors ${task?.pinned ? "text-[#F4A100]" : "text-[#8C948B] hover:text-[#8c948b]"}`}>
						{task?.pinned ? <TbStarFilled size={20} /> : <TbStar size={20} />}
					</button>
				</div>
				{task?.responsible && (
					<p className="border-b border-inkLine px-16 py-14 text-13 text-[#8c948b] md:px-32">
						{t("responsible")} <span className="text-[#f1f4ee]">{task.responsible}</span>
					</p>
				)}
				<div className="flex flex-col items-stretch gap-12 px-16 py-20 md:flex-row md:items-center md:justify-end md:gap-12 md:px-32 md:py-24">
					<Link href={`/${locale}/crm/tasks`} className="fs-btn fs-btn-ghost h-40">
						{t("edit")}
					</Link>
					{status !== "completed" && (
						<button
							type="button"
							onClick={finish}
							disabled={busy}
							className="fs-btn fs-btn-primary h-40 disabled:opacity-60 md:min-w-[126px]">
							{t("finish")}
						</button>
					)}
				</div>
			</div>
		</Modal>
	);
}
