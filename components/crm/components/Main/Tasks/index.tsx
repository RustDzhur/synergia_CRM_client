"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbBellOff, TbChevronDown, TbDots, TbPin, TbPlus, TbSettings } from "react-icons/tb";
import { Task, TaskStatus, taskStatus, useTaskStore } from "@/store/useTaskStore";
import { addDays, localeTag } from "@/utils/dateHelpers";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import Checkbox from "../shared/Checkbox";
import ConfirmDialog from "../shared/ConfirmDialog";
import TaskModal from "./TaskModal";
import Planner from "./Planner";
import Projects from "./Projects";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import SearchBox from "../shared/SearchBox";

type View = "list" | "deadline" | "planner";

// Начало суток: планировщик сравнивает задачи по календарным дням, а не по времени
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
type Action = "" | "done" | "active" | "delete";

// Как давно прошёл срок: «4 months» (единицы и язык — через Intl)
function overdueLabel(deadline: string, locale: string): string {
    const minutes = Math.max(1, Math.floor((Date.now() - new Date(deadline).getTime()) / 60000));
    const units: Array<[Intl.NumberFormatOptions["unit"], number]> = [
        ["year", 525600], ["month", 43200], ["week", 10080], ["day", 1440], ["hour", 60], ["minute", 1],
    ];
    const [unit, size] = units.find(([, s]) => minutes >= s) ?? units[units.length - 1];
    return new Intl.NumberFormat(localeTag(locale), { style: "unit", unit, unitDisplay: "long" }).format(Math.floor(minutes / size));
}

function Menu({ options, children, align = "left" }: { options: Array<{ label: string; danger?: boolean; onClick: () => void }>; children: (props: { open: boolean; toggle: () => void }) => React.ReactNode; align?: "left" | "right" }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, open, () => setOpen(false));
    return (
        <div ref={ref} className="relative inline-block">
            {children({ open, toggle: () => setOpen(!open) })}
            <Dropdown open={open} className={`${align === "left" ? "left-0" : "right-0"} top-full mt-8 min-w-[190px]`}>
                <div className="fs-popover overflow-hidden py-4 text-left">
                    {options.map((o, i) => (
                        <div key={o.label}>
                            {i > 0 && <div className="my-4 border-t border-inkLine" />}
                            <button
                                type="button"
                                onClick={() => { setOpen(false); o.onClick(); }}
                                className={`fs-popover-row block w-full px-14 py-10 text-left text-13 transition-colors duration-150 ${o.danger ? "!text-danger" : ""}`}>
                                {o.label}
                            </button>
                        </div>
                    ))}
                </div>
            </Dropdown>
        </div>
    );
}

// Раздел Tasks and Projects: таблица задач (List), группировка по срокам (Deadline), пакетные действия.
export default function Tasks() {
    const t = useTranslations("tasks");
    const locale = useLocale();
    const tag = localeTag(locale);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, search, statusFilter, responsible]);

    // исполнители для фильтра — те, кто реально встречается в задачах
    const responsibles = Array.from(new Set(tasks.map((task) => (task.responsible ?? "").trim()).filter(Boolean))).sort();

    const overdue = tasks.filter((task) => taskStatus(task, now) === "ended").length;
    const commentsCount = tasks.reduce((sum, task) => sum + (task.activities?.filter((a) => a.type === "comment").length ?? 0), 0);
    const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r._id));

    const statusLabel: Record<"all" | TaskStatus, string> = {
        all: t("allStatuses"), active: t("statusActive"), completed: t("statusCompleted"), ended: t("statusEnded"),
    };
    const dateText = (iso?: string, month: "long" | "short" = "long") =>
        iso ? new Date(iso).toLocaleString(tag, { day: "numeric", month, hour: "2-digit", minute: "2-digit" }) : "";

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

    const th = "px-10 text-center";
    const td = "truncate px-10 text-center text-13";
    const tab = (active: boolean) =>
        `h-30 shrink-0 rounded-8 px-12 text-12 font-medium transition-colors duration-150 ${
            active ? "bg-[rgba(198,255,77,0.14)] text-[#c6ff4d]" : "text-[#8c948b] hover:text-[#f1f4ee]"
        }`;

    const deadlineBadge = (task: Task) => {
        const status = taskStatus(task, now);
        if (status === "completed") return <span className="rounded-6 bg-[rgba(11,208,101,0.16)] px-8 py-4 text-11 font-semibold capitalize text-[#0BD065]">{t("statusCompleted")}</span>;
        if (status === "ended" && task.deadline) return <span className="rounded-6 bg-[rgba(200,16,46,0.18)] px-8 py-4 text-11 font-semibold capitalize text-[#ff7b8a]">{overdueLabel(task.deadline, locale)}</span>;
        return <span>{task.deadline ? dateText(task.deadline) : t("noDeadline")}</span>;
    };

    const groups = useMemo(() => {
        const todayKey = new Date().toDateString();
        const result: Record<"overdue" | "today" | "upcoming" | "none", Task[]> = { overdue: [], today: [], upcoming: [], none: [] };
        rows.forEach((task) => {
            if (!task.deadline) return result.none.push(task);
            const status = taskStatus(task);
            if (status === "ended") return result.overdue.push(task);
            if (new Date(task.deadline).toDateString() === todayKey) return result.today.push(task);
            result.upcoming.push(task);
        });
        return result;
    }, [rows]);

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

                    {view === "deadline" && (
                        <div className="flex flex-col gap-24">
                            {(["overdue", "today", "upcoming", "none"] as const).map((g) =>
                                groups[g].length === 0 ? null : (
                                    <section key={g} className="animate-fade-in">
                                        <h3 className={`mb-10 text-13 font-semibold ${g === "overdue" ? "text-danger" : "text-[#8c948b]"}`}>
                                            {g === "overdue" ? t("overdue") : g === "today" ? t("today") : g === "upcoming" ? t("upcoming") : t("noDeadline")} ({groups[g].length})
                                        </h3>
                                        <ul className="fs-card overflow-hidden">
                                            {groups[g].map((task) => (
                                                <li key={task._id} className="flex flex-wrap items-center justify-between gap-12 border-b border-inkLineSoft px-20 py-14 last:border-b-0 hover:bg-[rgba(255,255,255,0.025)]">
                                                    <button type="button" onClick={() => openEdit(task)} className={`text-left text-13 text-[#f1f4ee] transition-colors hover:text-[#c6ff4d] ${task.completed ? "line-through" : ""}`}>{task.title}</button>
                                                    <span className="text-12 text-[#8c948b]">{deadlineBadge(task)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )
                            )}
                            {rows.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">{isLoading ? "…" : t("empty")}</p>}
                        </div>
                    )}

                    {view === "list" && (
                        <>
                            <div className="fs-card min-h-[300px] overflow-x-auto">
                                <table className="fs-table min-w-[900px] table-fixed">
                                    <thead>
                                        <tr>
                                            <th className="w-[46px] pl-16">
                                                <Checkbox checked={allChecked} onChange={(c) => setSelected(c ? rows.map((r) => r._id) : [])} label={t("selectAll")} />
                                            </th>
                                            <th className="w-[60px]"><TbSettings size={18} className="mx-auto block text-[#8c948b]" aria-hidden /></th>
                                            <th className={th}>{t("name")}</th>
                                            <th className={`${th} w-[200px]`}>
                                                <Menu
                                                    align="right"
                                                    options={(["all", "active", "completed", "ended"] as const).map((s) => ({ label: statusLabel[s], onClick: () => setStatusFilter(s) }))}>
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
                                                    <Checkbox checked={selected.includes(task._id)} onChange={() => setSelected((s) => (s.includes(task._id) ? s.filter((x) => x !== task._id) : [...s, task._id]))} label={t("selectRow")} />
                                                </td>
                                                <td className="text-center">
                                                    <Menu options={[{ label: t("editTask"), onClick: () => openEdit(task) }, { label: t("actionDelete"), danger: true, onClick: () => setConfirmIds([task._id]) }]}>
                                                        {({ open, toggle }) => (
                                                            <button type="button" onClick={toggle} aria-expanded={open} aria-label={t("options")} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]"><TbDots size={20} /></button>
                                                        )}
                                                    </Menu>
                                                </td>
                                                <td className="px-10 text-center">
                                                    <span className="inline-flex max-w-full items-center gap-8">
                                                        <button type="button" onClick={() => openEdit(task)} className={`truncate text-13 text-[#f1f4ee] transition-colors hover:text-[#c6ff4d] ${task.completed ? "line-through" : ""}`}>{task.title}</button>
                                                        <button type="button" aria-label={t("pinned")} aria-pressed={task.pinned} onClick={() => updateTask(task._id, { pinned: !task.pinned })} className={`shrink-0 transition-colors ${task.pinned ? "text-[#c6ff4d]" : "text-[#8C948B] hover:text-[#8c948b]"}`}><TbPin size={16} /></button>
                                                        <button type="button" aria-label={t("muted")} aria-pressed={task.muted} onClick={() => updateTask(task._id, { muted: !task.muted })} className={`shrink-0 transition-colors ${task.muted ? "text-[#c6ff4d]" : "text-[#8C948B] hover:text-[#8c948b]"}`}><TbBellOff size={16} /></button>
                                                    </span>
                                                </td>
                                                <td className={td}>{dateText(task.updatedAt ?? task.createdAt, "short")}</td>
                                                <td className="px-10 text-center">{deadlineBadge(task)}</td>
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
                                <button type="button" onClick={applyAction} disabled={!action || selected.length === 0} className="fs-btn fs-btn-ghost h-38 disabled:cursor-not-allowed disabled:opacity-40">
                                    {t("apply")}
                                </button>
                                <Menu
                                    options={[
                                        { label: t("actionDone"), onClick: () => setAction("done") },
                                        { label: t("actionActive"), onClick: () => setAction("active") },
                                        { label: t("actionDelete"), danger: true, onClick: () => setAction("delete") },
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
