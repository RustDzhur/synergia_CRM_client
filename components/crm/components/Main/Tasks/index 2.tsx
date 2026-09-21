"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdMenu, MdMoreHoriz, MdNotificationsOff, MdPushPin, MdSearch, MdSettings, MdTune } from "react-icons/md";
import { RiArrowDownSLine } from "react-icons/ri";
import { Task, TaskStatus, taskStatus, useTaskStore } from "@/app/store/useTaskStore";
import { localeTag } from "@/app/utils/dateHelpers";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import Checkbox from "../shared/Checkbox";
import ConfirmDialog from "../shared/ConfirmDialog";
import TaskModal from "./TaskModal";
import { TAB_BAR } from "../shared/tabBar";

type View = "list" | "deadline" | "planner";
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
                <div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white text-left shadow-custom">
                    {options.map((o, i) => (
                        <div key={o.label}>
                            {i > 0 && <div className="border-t border-[#E2F1F5]" />}
                            <button
                                type="button"
                                onClick={() => { setOpen(false); o.onClick(); }}
                                className={`block w-full px-16 py-10 text-left text-16 transition-colors duration-150 hover:bg-gray ${o.danger ? "text-danger" : "text-[#666666]"}`}>
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
    const [selected, setSelected] = useState<string[]>([]);
    const [action, setAction] = useState<Action>("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [confirmIds, setConfirmIds] = useState<string[] | null>(null);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const now = Date.now();
    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return tasks
            .filter((task) => statusFilter === "all" || taskStatus(task, now) === statusFilter)
            .filter((task) => !q || [task.title, task.responsible, task.createdBy].some((v) => v?.toLowerCase().includes(q)))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, search, statusFilter]);

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

    const th = "border-l border-[#F0F0F0] px-10 py-16 text-center text-16 font-medium text-[#999999] md:text-18";
    const td = "truncate px-10 text-center text-16 text-[#999999] md:text-18";
    const tab = (active: boolean) =>
        `px-16 py-10 text-16 font-medium tracking-[0.32px] border-b-2 transition-colors duration-200 ${
            active ? "border-primaryColor text-primaryColor" : "border-transparent text-[#999999] hover:text-[#666666]"
        }`;

    const deadlineBadge = (task: Task) => {
        const status = taskStatus(task, now);
        if (status === "completed") return <span className="rounded-4 bg-[#0BD065] px-8 py-4 text-14 font-semibold capitalize text-white">{t("statusCompleted")}</span>;
        if (status === "ended" && task.deadline) return <span className="rounded-4 bg-[#C8102E] px-8 py-4 text-14 font-semibold capitalize text-white">{overdueLabel(task.deadline, locale)}</span>;
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
        <div className="p-16 md:p-30">
            <div className="mb-20 flex flex-wrap items-center justify-between gap-16">
                <div className={TAB_BAR}>
                    {(["tasks", "projects"] as const).map((key) => (
                        <button
                            key={key}
                            onClick={() => setSection(key)}
                            className={`rounded-4 px-16 py-10 text-16 font-medium tracking-[0.32px] transition-colors duration-200 ${
                                section === key ? "bg-primaryColor text-white" : "text-[#CCCCCC] hover:text-[#999999]"
                            }`}>
                            {t(key)}
                        </button>
                    ))}
                </div>
                <div className="flex h-[50px] w-full items-center justify-between rounded-8 border-2 border-[#E6E6E6] bg-white px-16 shadow-custom transition-colors focus-within:border-[#5EA8F5] md:w-[220px] lg:w-[350px]">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="w-full text-18 outline-none placeholder:text-[#CCCCCC]" />
                    <div className="flex shrink-0 items-center gap-10 text-[#CCCCCC]"><MdSearch size={20} /><MdTune size={20} /></div>
                </div>
            </div>

            {section === "projects" ? (
                <p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("projectsSoon")}</p>
            ) : (
                <>
                    <div className="mb-20 flex flex-wrap items-center justify-between gap-16">
                        <div className="flex items-center">
                            {(["list", "deadline", "planner"] as const).map((v) => (
                                <button key={v} className={tab(view === v)} onClick={() => setView(v)}>
                                    {v === "deadline" ? t("deadlineTab") : t(v)}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-16 text-16 font-medium text-[#666666]">
                            <span>{t("myItems")}:</span>
                            <span className="flex items-center gap-6">{t("overdue")}<span className="rounded-4 bg-primaryColor px-4 text-white">{overdue}</span></span>
                            <span className="flex items-center gap-6">{t("comments")}<span className="rounded-4 bg-primaryColor px-4 text-white">{commentsCount}</span></span>
                        </div>
                        <div className="flex items-center gap-16">
                            <button type="button" onClick={() => openEdit(null)} className="h-[44px] rounded-4 bg-primaryColor px-24 text-16 font-semibold text-white shadow-custom transition-opacity hover:opacity-80">
                                {t("addTask")}
                            </button>
                            <MoreIcon />
                        </div>
                    </div>

                    {view === "planner" && <p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("plannerSoon")}</p>}

                    {view === "deadline" && (
                        <div className="flex flex-col gap-24">
                            {(["overdue", "today", "upcoming", "none"] as const).map((g) =>
                                groups[g].length === 0 ? null : (
                                    <section key={g} className="animate-fade-in">
                                        <h3 className={`mb-10 text-20 font-medium ${g === "overdue" ? "text-danger" : "text-[#666666]"}`}>
                                            {g === "overdue" ? t("overdue") : g === "today" ? t("today") : g === "upcoming" ? t("upcoming") : t("noDeadline")} ({groups[g].length})
                                        </h3>
                                        <ul className="overflow-hidden rounded-16 bg-white shadow-custom">
                                            {groups[g].map((task) => (
                                                <li key={task._id} className="flex flex-wrap items-center justify-between gap-12 border-b border-[#F0F0F0] px-20 py-14 last:border-b-0 hover:bg-[#F7F9FF]">
                                                    <button type="button" onClick={() => openEdit(task)} className={`text-left text-18 text-[#666666] ${task.completed ? "line-through" : ""}`}>{task.title}</button>
                                                    <span className="text-16 text-[#999999]">{deadlineBadge(task)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )
                            )}
                            {rows.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{isLoading ? "…" : t("empty")}</p>}
                        </div>
                    )}

                    {view === "list" && (
                        <>
                            <div className="min-h-[300px] overflow-x-auto rounded-16 bg-white shadow-custom">
                                <table className="w-full min-w-[900px] table-fixed border-collapse">
                                    <thead>
                                        <tr className="border-b border-[#F0F0F0]">
                                            <th className="w-[46px] py-16 pl-16 text-left">
                                                <Checkbox checked={allChecked} onChange={(c) => setSelected(c ? rows.map((r) => r._id) : [])} label={t("selectAll")} />
                                            </th>
                                            <th className="w-[60px] text-center text-[#999999]"><MdSettings size={22} className="mx-auto" aria-hidden /></th>
                                            <th className={th}>{t("name")}</th>
                                            <th className={`${th} w-[200px]`}>
                                                <Menu
                                                    align="right"
                                                    options={(["all", "active", "completed", "ended"] as const).map((s) => ({ label: statusLabel[s], onClick: () => setStatusFilter(s) }))}>
                                                    {({ open, toggle }) => (
                                                        <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex items-center gap-6 transition-colors hover:text-primaryColor">
                                                            {statusFilter === "all" ? t("status") : statusLabel[statusFilter]}
                                                            <RiArrowDownSLine size={22} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
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
                                            <tr key={task._id} className={`h-[60px] animate-fade-in border-b border-[#F0F0F0] transition-colors duration-150 hover:bg-[#F7F9FF] ${selected.includes(task._id) ? "bg-[#F5F9FF]" : ""}`}>
                                                <td className="pl-16">
                                                    <Checkbox checked={selected.includes(task._id)} onChange={() => setSelected((s) => (s.includes(task._id) ? s.filter((x) => x !== task._id) : [...s, task._id]))} label={t("selectRow")} />
                                                </td>
                                                <td className="text-center">
                                                    <Menu options={[{ label: t("editTask"), onClick: () => openEdit(task) }, { label: t("actionDelete"), danger: true, onClick: () => setConfirmIds([task._id]) }]}>
                                                        {({ open, toggle }) => (
                                                            <button type="button" onClick={toggle} aria-expanded={open} aria-label={t("options")} className="text-[#666666] transition-colors hover:text-primaryColor"><MdMenu size={22} /></button>
                                                        )}
                                                    </Menu>
                                                </td>
                                                <td className="px-10 text-center">
                                                    <span className="inline-flex max-w-full items-center gap-8">
                                                        <button type="button" onClick={() => openEdit(task)} className={`truncate text-16 text-[#666666] transition-colors hover:text-primaryColor md:text-18 ${task.completed ? "line-through" : ""}`}>{task.title}</button>
                                                        <button type="button" aria-label={t("pinned")} aria-pressed={task.pinned} onClick={() => updateTask(task._id, { pinned: !task.pinned })} className={`shrink-0 transition-colors ${task.pinned ? "text-primaryColor" : "text-[#B3B3B3] hover:text-[#666666]"}`}><MdPushPin size={18} /></button>
                                                        <button type="button" aria-label={t("muted")} aria-pressed={task.muted} onClick={() => updateTask(task._id, { muted: !task.muted })} className={`shrink-0 transition-colors ${task.muted ? "text-primaryColor" : "text-[#B3B3B3] hover:text-[#666666]"}`}><MdNotificationsOff size={18} /></button>
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
                                {rows.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{isLoading ? "…" : t("empty")}</p>}
                                <footer className="flex flex-wrap items-center justify-between gap-x-24 gap-y-8 border-t border-[#F0F0F0] px-18 py-16 text-16 uppercase text-[#999999]">
                                    <span>{t("selected", { selected: selected.length, total: rows.length })}</span>
                                    <span>{t("total", { total: rows.length })}</span>
                                    <span>{t("pages", { pages: 1 })}</span>
                                </footer>
                            </div>

                            <div className="mt-20 flex flex-wrap items-center gap-16">
                                <button type="button" onClick={applyAction} disabled={!action || selected.length === 0} className="h-[44px] rounded-4 border-2 border-[#CCCCCC] px-24 text-16 font-medium text-[#999999] transition-colors enabled:hover:border-primaryColor enabled:hover:text-primaryColor disabled:cursor-not-allowed">
                                    {t("apply")}
                                </button>
                                <Menu
                                    options={[
                                        { label: t("actionDone"), onClick: () => setAction("done") },
                                        { label: t("actionActive"), onClick: () => setAction("active") },
                                        { label: t("actionDelete"), danger: true, onClick: () => setAction("delete") },
                                    ]}>
                                    {({ open, toggle }) => (
                                        <button type="button" onClick={toggle} aria-expanded={open} className="flex h-[44px] items-center gap-8 rounded-4 border-2 border-[#CCCCCC] px-16 text-16 font-medium text-[#999999] transition-colors hover:border-primaryColor">
                                            {action === "done" ? t("actionDone") : action === "active" ? t("actionActive") : action === "delete" ? t("actionDelete") : t("selectAction")}
                                            <RiArrowDownSLine size={20} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
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
    return <MdMoreHoriz size={20} className="text-[#666666]" aria-hidden />;
}
