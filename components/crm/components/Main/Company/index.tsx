"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbAdjustments, TbChevronLeft, TbChevronRight, TbDots, TbPlus, TbSearch, TbSettings } from "react-icons/tb";
import { Employee, useEmployeeStore } from "@/app/store/useEmployeeStore";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import PageHeader from "@/components/crm/components/shared/PageHeader";
import ConfirmDialog from "../shared/ConfirmDialog";
import EmployeeModal from "./EmployeeModal";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import RecordsPage from "../shared/records/RecordsPage";
import SearchBox from "../shared/SearchBox";
import { KNOWLEDGE } from "./knowledge";
import Avatar from "../shared/Avatar";

const initials = (e: Employee) => `${e.firstname[0] ?? ""}${e.lastname[0] ?? ""}`.toUpperCase();

// Меню строки: «Edit / Delete» (значок «≡» слева в строке таблицы)
// Вкладка «База знаний»: отдельный раздел записей со своей шапкой и таблицей.
function KnowledgeTab() {
    return <RecordsPage config={KNOWLEDGE} />;
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    const t = useTranslations("company");
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, open, () => setOpen(false));
    const item = "fs-popover-row block w-full px-14 py-10 text-left text-13 transition-colors duration-150";
    return (
        <div ref={ref} className="relative inline-block">
            <button type="button" aria-label={t("rowMenu")} aria-expanded={open} onClick={() => setOpen(!open)} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
                <TbDots size={20} />
            </button>
            <Dropdown open={open} className="left-0 top-full mt-8 min-w-[150px]">
                <div className="fs-popover overflow-hidden py-4 text-left">
                    <button type="button" className={item} onClick={() => { setOpen(false); onEdit(); }}>{t("edit")}</button>
                    <div className="my-4 border-t border-inkLine" />
                    <button type="button" className={`${item} !text-danger`} onClick={() => { setOpen(false); onDelete(); }}>{t("delete")}</button>
                </div>
            </Dropdown>
        </div>
    );
}

// Раздел Company: сотрудники (таблица, приглашение, редактирование) и база знаний.
export default function Company() {
    const t = useTranslations("company");
    const { items, total, page, pages, isLoading, query, setQuery, department, setDepartment, position, setPosition, fetchEmployees, deleteEmployee } = useEmployeeStore();
    const [tab, setTab] = useState<"employees" | "knowledge">("employees");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [toDelete, setToDelete] = useState<Employee | null>(null);
    const firstLoad = useRef(true);
    // значения для выпадающих фильтров: из уже загруженных строк
    const departments = Array.from(new Set(items.map((e) => (e.department ?? "").trim()).filter(Boolean))).sort();
    const positions = Array.from(new Set(items.map((e) => (e.position ?? "").trim()).filter(Boolean))).sort();

    useEffect(() => { fetchEmployees(1); }, [fetchEmployees]);

    // поиск с задержкой 300 мс, чтобы не запрашивать сервер на каждую букву
    useEffect(() => {
        if (firstLoad.current) { firstLoad.current = false; return; }
        const timer = setTimeout(() => fetchEmployees(1), 300);
        return () => clearTimeout(timer);
    }, [query, department, position, fetchEmployees]);

    const th = "px-10 text-center";
    const td = "truncate px-10 text-center text-13";

    return (
        <div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
            <PageHeader>
                <div className="flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
                    <div className={TAB_BAR}>
                        {(["employees", "knowledge"] as const).map((key) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={`${TAB_ITEM} ${tab === key ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}
                            >
                                {key === "employees" ? t("employeesTab") : t("knowledgeBase")}
                            </button>
                        ))}
                    </div>

                    {tab === "employees" && (
                        <>
                            <SearchBox
                                value={query}
                                onChange={setQuery}
                                placeholder={t("search")}
                                filters={[
                                    { key: "department", label: t("department"), options: [{ value: "", label: t("allDepartments") }, ...departments.map((d) => ({ value: d, label: d }))] },
                                    { key: "position", label: t("position"), options: [{ value: "", label: t("allPositions") }, ...positions.map((p) => ({ value: p, label: p }))] },
                                ]}
                                active={{ department, position }}
                                onFilter={(key, value) => (key === "department" ? setDepartment(value) : setPosition(value))}
                                className="w-full md:w-[280px] lg:w-[420px]"
                            />
                            <button
                                type="button"
                                onClick={() => { setEditing(null); setModalOpen(true); }}
                                className="fs-btn fs-btn-primary h-40 w-full md:w-auto"
                            >
                                <TbPlus size={16} aria-hidden />
                                {t("invite")}
                            </button>
                        </>
                    )}
                </div>
            </PageHeader>

            {tab === "knowledge" ? (
                // База знаний — обычные записи раздела: та же таблица, поиск, фильтры и окно правки,
                // что и в других разделах, поэтому отдельной реализации не требует.
                <KnowledgeTab />
            ) : (
                <div className="fs-card min-h-[280px] overflow-x-auto">
                    <table className="fs-table min-w-[1040px] table-fixed">
                        <thead>
                            <tr>
                                <th className="w-[60px]"><TbSettings size={18} className="mx-auto block text-[#8c948b]" aria-hidden /></th>
                                <th className={`${th} w-[100px]`}>{t("photo")}</th>
                                <th className={`${th} w-[230px]`}>{t("fullName")}</th>
                                <th className={`${th} w-[200px]`}>{t("email")}</th>
                                <th className={`${th} w-[140px]`}>{t("workPhone")}</th>
                                <th className={th}>{t("position")}</th>
                                <th className={th}>{t("department")}</th>
                                <th className={`${th} w-[150px]`}>{t("internalPhone")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((e) => (
                                <tr key={e._id} className="h-[68px] animate-fade-in transition-colors duration-150">
                                    <td className="text-center"><RowMenu onEdit={() => { setEditing(e); setModalOpen(true); }} onDelete={() => setToDelete(e)} /></td>
                                    <td className="text-center">
                                        <Avatar src={e.avatarUrl} initials={initials(e)} size={40} className="mx-auto flex text-13" />
                                    </td>
                                    <td className={`${td} font-medium text-[#f1f4ee]`}>{e.firstname} {e.lastname}</td>
                                    <td className={td}>{e.email}</td>
                                    <td className={td}>{e.workPhone}</td>
                                    <td className={td}>{e.position}</td>
                                    <td className={td}>{e.department}</td>
                                    <td className={td}>{e.internalPhone}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!isLoading && items.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">{t("empty")}</p>}
                    {isLoading && items.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">…</p>}

                    <footer className="flex flex-wrap items-center gap-x-24 gap-y-8 border-t border-inkLine px-18 py-14 text-11 uppercase tracking-[0.08em] text-[#8c948b]">
                        <span>{t("total", { total })}</span>
                        <span>{t("pages", { pages })}</span>
                        <div className="flex w-full items-center justify-center gap-24 text-[#8c948b] md:ml-[-160px] md:flex-1">
                            <button type="button" disabled={page <= 1} onClick={() => fetchEmployees(page - 1)} className="flex items-center gap-6 transition-colors enabled:hover:text-[#c6ff4d] disabled:opacity-40">
                                <TbChevronLeft size={18} />{t("previous")}
                            </button>
                            <button type="button" disabled={page >= pages} onClick={() => fetchEmployees(page + 1)} className="flex items-center gap-6 transition-colors enabled:hover:text-[#c6ff4d] disabled:opacity-40">
                                {t("next")}<TbChevronRight size={18} />
                            </button>
                        </div>
                    </footer>
                </div>
            )}

            <EmployeeModal open={modalOpen} employee={editing} onClose={() => setModalOpen(false)} />
            <ConfirmDialog
                open={toDelete !== null}
                title={t("delete")}
                text={t("confirmDelete")}
                onCancel={() => setToDelete(null)}
                onConfirm={() => { const e = toDelete; setToDelete(null); if (e) deleteEmployee(e._id); }}
            />
        </div>
    );
}
