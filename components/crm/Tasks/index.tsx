"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbDots, TbPlus } from "react-icons/tb";
import { Task, TaskStatus, taskStatus, useTaskStore } from "@/store/useTaskStore";
import { addDays } from "@/utils/dateHelpers";
import PageHeader from "@/components/crm/shared/PageHeader";
import ConfirmDialog from "../shared/ConfirmDialog";
import TaskModal from "./TaskModal";
import Planner from "./Planner";
import Projects from "./Projects";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import SearchBox from "../shared/SearchBox";
import DeadlineView from "./tasksParts/DeadlineView";
import TaskListView from "./tasksParts/TaskListView";
import { Action, startOfDay, View } from "./tasksParts/model";

// Раздел Tasks and Projects: таблица задач (List), группировка по срокам (Deadline), пакетные действия.
export default function Tasks() {
    const t = useTranslations("tasks");
    const { tasks, isLoading, fetchTasks, updateTask, deleteTasks } = useTaskStore();
    const [section, setSection] = useState<"tasks" | "projects">("tasks");
    const [view, setView] = useState<View>("list");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
    const [responsible, setResponsible] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [action, setAction] = useState<Action>("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
    // Планировщик показывает две недели начиная с этой даты
    const [plannerStart, setPlannerStart] = useState(() => startOfDay(new Date()));

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const now = Date.now();
    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return tasks
            .filter((task) => statusFilter === "all" || taskStatus(task, now) === statusFilter)
            .filter((task) => !responsible || task.responsible === responsible)
            .filter((task) => !q || [task.title, task.responsible, task.createdBy].some((v) => v?.toLowerCase().includes(q)))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned));
        // now в зависимости не входит: он новый на каждый рендер и обнулил бы мемо. Цена — статус «просрочено»
        // при открытой странице обновляется вместе с данными или фильтром, а не по часам.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, search, statusFilter, responsible]);

    // исполнители для фильтра — те, кто реально встречается в задачах
    const responsibles = Array.from(new Set(tasks.map((task) => (task.responsible ?? "").trim()).filter(Boolean))).sort();

    const overdue = tasks.filter((task) => taskStatus(task, now) === "ended").length;
    const commentsCount = tasks.reduce((sum, task) => sum + (task.activities?.filter((a) => a.type === "comment").length ?? 0), 0);

    const statusLabel: Record<"all" | TaskStatus, string> = {
        all: t("allStatuses"), active: t("statusActive"), completed: t("statusCompleted"), ended: t("statusEnded"),
    };

    function openEdit(task: Task | null) {
        setEditing(task);
        setModalOpen(true);
    }

    async function applyAction() {
        if (!action || selected.length === 0) return;
        if (action === "delete") return setConfirmIds(selected);
        await Promise.all(selected.map((id) => updateTask(id, { completed: action === "done" })));
        toast.success(t("saved"));
        setSelected([]);
        setAction("");
    }

    async function confirmDelete() {
        const ids = confirmIds ?? [];
        setConfirmIds(null);
        await deleteTasks(ids);
        setSelected((s) => s.filter((id) => !ids.includes(id)));
        setAction("");
    }

    const tab = (active: boolean) =>
        `h-30 shrink-0 rounded-8 px-12 text-12 font-medium transition-colors duration-150 ${
            active ? "bg-[rgba(198,255,77,0.14)] text-[#c6ff4d]" : "text-[#8c948b] hover:text-[#f1f4ee]"
        }`;

    return (
        <div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
            <PageHeader>
                <div className="flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
                    <div className={TAB_BAR}>
                        {(["tasks", "projects"] as const).map((key) => (
                            <button
                                key={key}
                                onClick={() => setSection(key)}
                                className={`${TAB_ITEM} ${section === key ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}>
                                {t(key)}
                            </button>
                        ))}
                    </div>
                    <SearchBox
                        value={search}
                        onChange={setSearch}
                        placeholder={t("search")}
                        filters={[
                            {
                                key: "status",
                                label: t("filterStatus"),
                                // значения те же, что у переключателя статусов выше — подписи берём из него же
                                options: (["all", "active", "completed", "ended"] as const).map((v) => ({ value: v === "all" ? "" : v, label: statusLabel[v] })),
                            },
                            {
                                key: "responsible",
                                label: t("filterResponsible"),
                                options: [{ value: "", label: t("allResponsibles") }, ...responsibles.map((r) => ({ value: r, label: r }))],
                            },
                        ]}
                        active={{ status: statusFilter === "all" ? "" : statusFilter, responsible }}
                        onFilter={(key, value) => {
                            if (key === "status") setStatusFilter((value || "all") as "all" | TaskStatus);
                            else setResponsible(value);
                        }}
                        className="w-full shrink-0 md:w-[280px] lg:w-[420px]"
                    />
                </div>
            </PageHeader>

            {section === "projects" ? (
                <Projects onOpenTask={openEdit} />
            ) : (
                <>
                    <div className="mb-20 flex flex-wrap items-center justify-between gap-16">
                        <div className="flex items-center gap-2 rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] p-2">
                            {(["list", "deadline", "planner"] as const).map((v) => (
                                <button key={v} className={tab(view === v)} onClick={() => setView(v)}>
                                    {v === "deadline" ? t("deadlineTab") : t(v)}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-16 text-12 text-[#8c948b]">
                            <span>{t("myItems")}:</span>
                            <span className="flex items-center gap-6">{t("overdue")}<span className="flex h-20 items-center rounded-50 bg-[rgba(198,255,77,0.14)] px-8 text-11 font-semibold text-[#c6ff4d]">{overdue}</span></span>
                            <span className="flex items-center gap-6">{t("comments")}<span className="flex h-20 items-center rounded-50 bg-[rgba(198,255,77,0.14)] px-8 text-11 font-semibold text-[#c6ff4d]">{commentsCount}</span></span>
                        </div>
                        <div className="flex items-center gap-12">
                            <button type="button" onClick={() => openEdit(null)} className="fs-btn fs-btn-primary h-38">
                                <TbPlus size={16} aria-hidden />
                                {t("addTask")}
                            </button>
                            <MoreIcon />
                        </div>
                    </div>

                    {view === "planner" && (
                        <Planner
                            tasks={tasks}
                            start={plannerStart}
                            onShift={(weeks) => setPlannerStart((d) => addDays(d, weeks * 7))}
                            onToday={() => setPlannerStart(startOfDay(new Date()))}
                            onOpen={openEdit}
                        />
                    )}

                    {view === "deadline" && <DeadlineView rows={rows} isLoading={isLoading} onOpen={openEdit} />}

                    {view === "list" && (
                        <TaskListView
                            rows={rows}
                            isLoading={isLoading}
                            selected={selected}
                            onSelect={setSelected}
                            statusFilter={statusFilter}
                            statusLabel={statusLabel}
                            onStatusFilter={setStatusFilter}
                            action={action}
                            onAction={setAction}
                            onApply={applyAction}
                            onOpen={openEdit}
                            onDelete={setConfirmIds}
                            onUpdate={updateTask}
                        />
                    )}
                </>
            )}

            <TaskModal open={modalOpen} task={editing} onClose={() => setModalOpen(false)} />
            <ConfirmDialog
                open={confirmIds !== null}
                title={t("actionDelete")}
                text={t("confirmDelete")}
                onCancel={() => setConfirmIds(null)}
                onConfirm={confirmDelete}
            />
        </div>
    );
}

function MoreIcon() {
    return <TbDots size={20} className="text-[#8c948b]" aria-hidden />;
}
