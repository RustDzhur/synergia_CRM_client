"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose, MdStar } from "react-icons/md";
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
	const statusColor = status === "ended" ? "text-[#D0021B]" : status === "completed" ? "text-[#009A2B]" : "text-primaryColor";

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
			<div className="overflow-hidden bg-white shadow-heroImage max-md:min-h-screen md:rounded-24">
				<div className="flex items-center justify-between gap-16 bg-[#F5F7FC] px-16 py-16 md:bg-white md:px-40 md:pt-30">
					<h2 className="min-w-0 truncate text-24 font-medium text-[#666666]">{task?.title}</h2>
					<button type="button" onClick={onClose} aria-label={t("close")} className="shrink-0 text-[#4D4D4D] transition-opacity hover:opacity-70">
						<MdClose size={28} />
					</button>
				</div>
				<p className={`px-16 pb-16 pt-16 text-18 md:px-40 md:pt-10 md:text-20 ${statusColor}`}>
					{t("taskNumber", { number })} - {statusText}
				</p>
				<div className="flex min-h-[140px] items-start justify-between gap-16 border-y border-[#E6E6E6] px-16 py-16 md:px-40">
					<p className="whitespace-pre-wrap break-words text-16 text-[#666666] md:text-18">{task?.description || task?.title}</p>
					<button
						type="button"
						aria-label={t("pin")}
						aria-pressed={task?.pinned ?? false}
						onClick={togglePin}
						className={`shrink-0 transition-colors ${task?.pinned ? "text-[#F4A100]" : "text-[#D9D9D9] hover:text-[#B3B3B3]"}`}>
						<MdStar size={26} />
					</button>
				</div>
				{task?.responsible && (
					<p className="border-b border-[#E6E6E6] px-16 py-16 text-16 text-[#B3B3B3] md:px-40">
						{t("responsible")} <span className="text-[#666666]">{task.responsible}</span>
					</p>
				)}
				<div className="flex flex-col items-stretch gap-12 px-16 py-24 md:flex-row md:items-center md:justify-end md:gap-20 md:px-40 md:py-30">
					<Link href={`/${locale}/crm/tasks`} className="px-16 py-10 text-center text-16 font-medium text-[#B3B3B3] transition-colors hover:text-primaryColor">
						{t("edit")}
					</Link>
					{status !== "completed" && (
						<button
							type="button"
							onClick={finish}
							disabled={busy}
							className="h-[50px] rounded-4 bg-primaryColor px-30 text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-60 md:min-w-[126px]">
							{t("finish")}
						</button>
					)}
				</div>
			</div>
		</Modal>
	);
}
